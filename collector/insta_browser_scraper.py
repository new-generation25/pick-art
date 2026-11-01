"""인스타그램 계정의 새 게시물에서 행사 후보를 뽑는다(로그인 없음).

- 프로필: 로그아웃 상태의 브라우저(Playwright)로 열면 최근 12개 게시물 코드와 게시일이 보인다
- 캡션: /p/<코드>/embed/captioned/ 는 로그인 없이 작성자와 캡션 전문을 준다
- 행사 추출: 캡션의 '📅 날짜 줄 / 📍 장소 줄' 묶음 (naver_blog_scraper.extract_events 와 같은 규칙)
- 결과는 raw_posts 에 status='REVIEW' 로 쌓는다. 정기 자동 공개(COLLECTED·PENDING 대상)에는 걸리지 않고,
  주간 검토(tools/review_instagram.py)에서 공식 채널을 찾아보거나 게시물 자체를 출처로 확정한 뒤 공개한다
  (이 앱은 공식 채널에 없는 소규모 행사를 알리는 것이 목적이라, 공식 채널이 없어도 날짜·장소가 분명하면 공개한다)
"""
import asyncio
import html
import json
import os
import re
from datetime import date

from naver_blog_scraper import extract_events, _norm

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
SEEN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache", "insta_seen.json")
EVENT_WORDS = re.compile(r"축제|공연|전시|음악회|콘서트|페스티벌|문화제|마켓|플리마켓|버스킹|연주회|체험|클래스|상영|야행|행사")
# 행정 안내·모집·헌혈처럼 행사 정보가 아닌 글 (캡션 앞부분 기준)
NOT_EVENT = re.compile(r"헌혈|노선|시내버스|야구|축구|배구|농구|마라톤|채용|구인|모집합니다|지원사업|과태료|체납|세금|보험료|실종|검진|예방접종|상품권|할인 ?행사|공사|통제")
ALT_DATE =re.compile(r"on (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (20\d\d)")
MONTHS = {m: i for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August",
                                      "September", "October", "November", "December"], 1)}


def load_seen():
    try:
        return json.load(open(SEEN_PATH, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_seen(seen):
    os.makedirs(os.path.dirname(SEEN_PATH), exist_ok=True)
    json.dump(seen, open(SEEN_PATH, "w", encoding="utf-8"), ensure_ascii=False)


async def list_posts(page, handle):
    """프로필 그리드의 게시물 (코드, 게시일) 목록. 로그아웃 상태라 최근 12개 정도만 보인다."""
    await page.goto(f"https://www.instagram.com/{handle}/", wait_until="domcontentloaded")
    await page.wait_for_timeout(4000)
    items = await page.eval_on_selector_all(
        'a[href*="/p/"],a[href*="/reel/"]',
        'els => els.map(e => [e.getAttribute("href"), (e.querySelector("img") || {}).alt || ""])')
    out, seen = [], set()
    for href, alt in items:
        m = re.search(r"/(?:p|reel)/([\w-]+)/", href)
        if not m or m.group(1) in seen:
            continue
        seen.add(m.group(1))
        d = ALT_DATE.search(alt)
        posted = date(int(d.group(3)), MONTHS[d.group(1)], int(d.group(2))) if d else None
        out.append((m.group(1), posted))
    return out


async def fetch_caption(page, code):
    """embed 페이지를 같은 브라우저로 열어 작성자와 캡션을 읽는다."""
    r = await page.goto(f"https://www.instagram.com/p/{code}/embed/captioned/", wait_until="domcontentloaded")
    if not r or r.status != 200:
        return None, None
    got = await page.evaluate("""() => {
        const u = document.querySelector('.UsernameText'); const c = document.querySelector('.Caption');
        return [u ? u.innerText : null, c ? c.innerText : ''];
    }""")
    author, t = got[0], got[1] or ""
    # 캡션 앞에 붙는 작성자 이름 줄과 '댓글 모두 보기' 꼬리를 뗀다
    if author:
        t = re.sub(r"^\s*" + re.escape(author) + r"\s*", "", t)
    t = re.sub(r"\n?댓글 \d+개 모두 보기.*$", "", t, flags=re.S)
    return author, t.strip()


TITLE_HINT = re.compile(r"「|《|〈|<|‘|'|\"|제\s?\d+\s?회|축제|페스티벌|공연|음악회|콘서트|전시|문화제|마켓|클래스|대회|상영|야행")
SIGNUP = re.compile(r"신청|접수|모집|마감|발표|수강료|참가비|문의")
DATE_LINE = re.compile(r"^(📅|🗓|📆)|일시|일정|날짜|기간|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\.\s*\d{1,2}\.?\s*\(")


def extract_post_event(lines, ref, url):
    """게시물 하나 = 행사 하나로 보고 제목·날짜·장소를 뽑는다. 목록형(행사 3개 이상)이면 블로그 규칙으로 여러 건."""
    multi = extract_events(lines, ref, url)
    if len(multi) >= 3:
        return multi
    from naver_blog_scraper import parse_period, _clean, EXCLUDE
    per = None
    # 표지(📅·일시·날짜·기간) 있는 줄을 먼저, 없으면 본문 속 날짜 문장을 본다
    marked = [ln for ln in lines if re.search(r"^(📅|🗓|📆)|일시|일정|날짜|기간", ln)]
    for ln in marked + [ln for ln in lines if ln not in marked]:
        if DATE_LINE.search(ln) and not SIGNUP.search(ln):
            per = parse_period(re.sub(r"^.*?(일시|일정|날짜|기간)\s*[:：|]?\s*", "", ln), ref)
            if per:
                break
    if not per:
        return []
    text = " ".join(lines[:15])
    head = [ln for ln in lines[:8] if len(_clean(ln)) >= 4 and not DATE_LINE.search(ln)]
    title = next((ln for ln in head if TITLE_HINT.search(ln)), head[0] if head else "")
    if len(_clean(title)) > 30:
        # 긴 홍보 문장 대신 괄호 속 작품명이나 '제N회 ○○축제' 같은 행사명
        m = re.search(r"[「《〈<]([^」》〉>]{2,40})[」》〉>]", text) or \
            re.search(r"((?:20\d\d\s*)?제\s?\d+\s?회\s?[가-힣A-Za-z0-9·&]+(?:\s[가-힣A-Za-z0-9·&]+){0,3}?\s?"
                      r"(?:축제|문화제|페스티벌|페스타|음악회|콘서트|전시회|특별전|마켓|대회|야행))", text) or \
            re.search(r"((?:20\d\d\s*)?[가-힣A-Za-z0-9·&]+(?:\s[가-힣A-Za-z0-9·&]+){0,3}\s?"
                      r"(?:축제|문화제|페스티벌|페스타|음악회|콘서트|전시회|특별전|마켓|대회|야행))", text)
        if m:
            title = m.group(1)
    title = _clean(re.sub(r"\*+", "", title))[:80]
    if not title or EXCLUDE.search(title):
        return []
    # '장소' 줄을 먼저, 없으면 📍 줄. '○○ 안내' 같은 머리글 줄은 장소로 보지 않는다
    cands = [ln for ln in lines if "장소" in ln] + [ln for ln in lines if ln.startswith("📍")]
    venue = next((v for v in (_clean(re.sub(r"^.*?(장소|📍)\s*[:：|]?\s*(장소\s*[:：|]?\s*)?", "", ln)) for ln in cands if not SIGNUP.search(ln))
                  if v and not re.search(r"안내$", v)), "")
    cat = "축제" if re.search(r"축제|페스티벌|문화제|야행|페스타", title) else \
          "전시" if re.search(r"전시|展|특별전|기획전", title) else \
          "공연" if re.search(r"공연|음악회|콘서트|연주|버스킹|소리극|연극|뮤지컬", title + text[:300]) else "행사"
    return [{"title": title, "category": cat, "venue": venue[:60], "start": per[0], "end": per[1], "time": per[2], "url": url}]


async def collect_account(page, db, account, published, seen, max_age_days=21, dry=False):
    """한 계정의 새 게시물을 읽어 행사 후보를 REVIEW 로 쌓는다. 반환: (새 게시물 수, 후보 수, 후보 목록)"""
    handle, role, region = account["handle"], account.get("role") or "", account.get("region") or ""
    done = set(seen.get(handle, []))
    posts = await list_posts(page, handle)
    found, n_new = [], 0
    for code, posted in posts:
        if code in done:
            continue
        done.add(code)
        if posted and (date.today() - posted).days > max_age_days:
            continue
        n_new += 1
        author, cap = await fetch_caption(page, code)
        await asyncio.sleep(1.5)
        if not cap or NOT_EVENT.search(cap[:200]):
            continue
        url = f"https://www.instagram.com/p/{code}/"
        lines = [ln.strip() for ln in cap.replace("#", "\n#").split("\n") if ln.strip() and not ln.strip().startswith("#")]
        evs = extract_post_event(lines, posted or date.today(), url)
        if not evs and EVENT_WORDS.search(cap):
            # 날짜가 캡션에 없고 포스터에만 있는 경우. 검토 때 이미지를 보고 날짜를 넣는다
            evs = [{"title": lines[0][:80] if lines else "", "category": "행사", "venue": "", "start": "", "end": "",
                    "time": "", "url": url, "image_only": True}]
        for i, e in enumerate(evs):
            n = _norm(e["title"])
            if e["start"] and any(n in p or p in n for p in published.get(e["start"], []) if p):
                continue
            e.update({"code": code, "account": handle, "author": author, "role": role, "posted": posted.isoformat() if posted else "",
                      "caption": cap[:1500]})
            found.append(e)
            if dry or db is None:
                continue
            sid = f"ig_{code}_{i}"
            if db.check_duplicate_source("인스타그램", sid):
                continue
            db.save_raw_post({
                "source": "인스타그램", "source_id": sid, "source_url": url,
                "content": {"title": e["title"], "description": cap[:1500],
                            "ai_suggestion": {"category": e["category"], "region": region, "venue": e["venue"],
                                              "date_start": e["start"], "date_end": e["end"], "date_parsed": bool(e["start"]),
                                              "price": "", "time": e["time"], "extracted_by": "insta_browser",
                                              "account": handle, "author": author, "role": role,
                                              "image_only": bool(e.get("image_only")),
                                              "poster_url": f"https://www.instagram.com/p/{code}/media/?size=l",
                                              "posted_at": e["posted"]}},
                "image_urls": [], "status": "REVIEW",
            })
    seen[handle] = sorted(done)[-200:]
    return n_new, len(found), found
