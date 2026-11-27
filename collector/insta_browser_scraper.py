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
NOT_EVENT = re.compile(r"헌혈|노선|시내버스|야구|축구|배구|농구|마라톤|채용|등본|증명서|발급|학부모|민원|구인|모집합니다|지원사업|과태료|체납|세금|보험료|실종|검진|예방접종|상품권|할인 ?행사|공사|통제")
MENTION = re.compile(r"(?<![\w.])@([A-Za-z0-9._]{3,30}[A-Za-z0-9_])")
ALT_DATE = re.compile(r"on (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (20\d\d)")
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
SIGNUP = re.compile(r"신청|접수|모집|마감|발표|수강료|참가비|문의|당첨")
# 문장으로 끝나는 줄(«…만나보세요», «…전해드립니다😊»). 장소 줄·행사 이름 줄을 가려낼 때만 쓴다
SENTENCE = re.compile(r"(니다|세요|어요|아요|예요|에요|해요|까요|네요|군요|지요|구요|는데|한데|되는|하는|있는)$")
# 표지가 붙은 줄: «공연명 : ○○»은 그 값이 제목이고, «장소: ○○»·«문의 ○○» 같은 줄은 제목 후보가 아니다
LABEL_TITLE = re.compile(r"^(?:공연명|전시명|행사명|작품명|축제명|제목)\s*[:：|]\s*(.{2,60})$")
LABEL_OTHER = re.compile(r"^(?:장소|전시 ?장소|공연 ?장소|행사 ?장소|일시|시간|공연 ?시간|관람 ?시간|문의|공연 ?문의|예매|관람료|입장료|티켓|주최|주관|후원)\s*[:：|]?\s")
# 연도로 시작하는 짧은 행사 이름 줄: «2026 부산국제아트페어 BIAF». 글 맨 위 3줄 안에 있을 때만 쓴다
YEAR_NAME = re.compile(r"^20\d\d\s+[가-힣A-Za-z]")

# 작품 이름만 적은 줄: «연극 [나는 나를 죽였다]», «🎭 연극 〈나는 나를 죽였다〉». 이런 줄이 있으면 홍보 문구보다 먼저 제목으로 쓴다
WORK_TITLE = re.compile(r"^(?:연극|뮤지컬|음악극|창작극|마당극|인형극|낭독극|낭독 ?공연|무용|오페라|창극|판소리|콘서트|음악회|연주회|독주회|리사이틀|"
                        r"전시|개인전|기획전|특별전|공연|영화)\s*[\[〈《「『<]\s*([^\]〉》」』>]{2,40}?)\s*[\]〉》」』>](.*)$")
NOT_A_WORK = re.compile(r"^(안내|공지|모집|마감|이벤트|예매|티켓)")
# 장소 이름으로 끝나는 말. 이 말이 든 짧은 줄은 행사 이름이 아니라 장소로 본다(«벡스코 제2전시장», «나다소극장»)
VENUE_WORD = re.compile(r"소극장|극장|아트홀|콘서트홀|전시장|전시실|전시관|아트센터|예술의전당|문화의전당|문화예술회관|문화회관|예술회관|미술관|갤러리|"
                        r"박물관|기념관|도서관|문화센터|음악당|공연장|스튜디오|씨어터|시어터|아트스페이스|회관|체육관|컨벤션센터|벡스코|BEXCO|"
                        r"[가-힣A-Za-z]홀(?![가-힣])", re.I)
EVENT_TYPE = re.compile(r"축제|페스티벌|페스타|문화제|음악회|콘서트|공연|전시회|전시(?!장|실|관)|특별전|기획전|개인전|아트페어|마켓|대회|상영|"
                        r"연주회|리사이틀|展|모집|안내|이벤트")
BULLET = re.compile(r"^[\s•·∙▪▫■□◾◽▶▷✔✅☑📌📍🏛\-–—*]+")


def venue_line(ln):
    """장소만 적은 줄이면 그 장소 이름, 아니면 ''.
    짧고(30자), 장소 말 뒤에 붙는 말이 짧고(«제2전시장», «대극장», «624»), 행사 종류 말·날짜·시각·문장 끝·쉼표가 없다."""
    c = BULLET.sub("", ln).strip()
    c = re.sub(r"^[^\w가-힣(]+", "", c)                              # 앞쪽 이모지·기호
    c = re.sub(r"[^\w가-힣)\]]+$", "", c)                           # 뒤쪽 이모지·기호
    c = re.sub(r"\s*[(（][^)）]{0,40}[)）]\s*$", "", c).strip()   # 뒤에 붙은 (주소)·(3층)
    hits = list(VENUE_WORD.finditer(c))
    if not (2 <= len(c) <= 30) or not hits:
        return ""
    if re.search(r"\d{1,2}\s*[:시]\s*\d{0,2}|\d{1,2}\s*[./월]\s*\d{1,2}|20\d\d|[\[〈《「『<'\"‘“,，｜|]|[.!?~]$", c):
        return ""
    if SENTENCE.search(c) or re.search(r"에서|으로|까지|부터|함께|특성|\s등(\s|$)", c):
        return ""
    tail = c[hits[-1].end():].strip()
    if len(tail) > 8 or " " in tail:                                 # 장소 말 뒤에 말이 이어지면 장소 이름이 아니라 글 제목이다
        return ""
    if EVENT_TYPE.search(VENUE_WORD.sub("", c)) or SIGNUP.search(c) or re.search(r"공고|대관|휴관", c):
        return ""
    return c
DATE_LINE = re.compile(r"^(📅|🗓|📆)|일시|일정|날짜|기간|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*[./]\s*\d{1,2}\.?\s*\(")
GREETING = re.compile(r"^안녕하세요|입니다[.!😊😁]*$|^(공지|알림|안내)\s*$")


def extract_post_event(lines, ref, url):
    """게시물 하나 = 행사 하나로 보고 제목·날짜·장소를 뽑는다. 목록형(행사 3개 이상)이면 블로그 규칙으로 여러 건."""
    multi = extract_events(lines, ref, url)
    if len(multi) >= 3:
        return multi
    from naver_blog_scraper import parse_period, _clean, EXCLUDE
    per = None
    # 표지(📅·일시·날짜·기간) 있는 줄을 먼저, 없으면 본문 속 날짜 문장을 본다
    marked = [i for i, ln in enumerate(lines) if re.search(r"^(📅|🗓|📆)|일시|일정|날짜|기간", ln)]
    order = marked + [i for i in range(len(lines)) if i not in marked]
    di = -1   # 날짜를 읽은 줄
    for i in order:
        ln = lines[i]
        if not DATE_LINE.search(ln) or SIGNUP.search(ln):
            continue
        per = parse_period(re.sub(r"^.*?(일시|일정|날짜|기간)\s*[:：|]?\s*", "", ln), ref)
        di = i
        if not per and i in marked and i + 1 < len(lines):  # '📅 일시' 줄 아래에 날짜가 오는 경우
            per = parse_period(re.sub(r"^[^\d]*", "", lines[i + 1]), ref)
            di = i + 1
        if per:
            break
    if not per:
        return []
    text = " ".join(lines[:15])
    # 장소만 적은 줄은 제목 후보에서 뺀다(«벡스코 제2전시장»이 «전시»에 걸려 제목이 되던 문제)
    head = [ln for ln in lines[:8] if len(_clean(ln)) >= 4 and not DATE_LINE.search(ln) and not GREETING.search(ln.strip())
            and not venue_line(ln) and not LABEL_OTHER.match(_clean(ln) + " ")]
    title = next((ln for ln in head if TITLE_HINT.search(ln)), head[0] if head else "")
    # 확실한 표시가 있으면 그것을 먼저 쓴다: ① «연극 [작품 이름]» 줄(이름만 적은 줄 먼저) ② «공연명 : ○○» ③ 맨 위 «2026 ○○» 행사 이름 줄
    works = [m for m in (WORK_TITLE.match(_clean(ln)) for ln in lines[:25]) if m and not NOT_A_WORK.match(m.group(1))]
    work = next((m.group(1) for m in works if not m.group(2).strip()), "") or (works[0].group(1) if works else "")
    label = next((m.group(1) for m in (LABEL_TITLE.match(_clean(ln)) for ln in lines[:25]) if m), "")
    def _tail(x):
        return re.sub(r"[^\w가-힣)\]〉》」』>]+$", "", x)
    named = next((_tail(_clean(ln)) for ln in lines[:3] if YEAR_NAME.match(_clean(ln)) and len(_tail(_clean(ln))) <= 30
                  and not SENTENCE.search(_tail(_clean(ln))) and not venue_line(ln)), "")
    near_top = title in lines[:4]
    if named and ((near_top and re.search(r"[「《〈<‘“'\"].{2,}[」》〉>’”'\"]", title))
                  or (len(_clean(title)) >= 6 and named.startswith(_tail(_clean(title))))):
        named = ""   # 맨 위 가까이에서 고른 제목에 작품 이름 표시(〈 〉, ‘ ’)가 있거나 같은 이름이면 그대로 둔다
    if work:
        title = work.strip()
    elif label:
        title = label.strip()
    elif named:
        title = named
    elif len(_clean(title)) > 30:
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
    def _venue(ln):
        v = _clean(re.sub(r"^.*?(장소|📍)\s*[:：|]?\s*(장소\s*[:：|]?\s*)?", "", ln))
        if not v and ln in lines and lines.index(ln) + 1 < len(lines):  # '📍 장소' 줄 아래에 장소가 오는 경우
            v = _clean(lines[lines.index(ln) + 1])
        return v
    venue = next((v for v in (_venue(ln) for ln in cands if not SIGNUP.search(ln))
                  if v and not re.search(r"안내$", v)), "")
    if not venue and di >= 0:
        # 표지 없이 적은 장소: 날짜 줄의 «| 장소», 또는 날짜 줄 바로 아래 4줄·위 2줄 안의 장소 줄
        tail = lines[di].split("|")[-1] if "|" in lines[di] else ""
        near = [tail] + lines[di + 1:di + 5] + lines[max(0, di - 2):di][::-1]
        venue = next((v for v in (venue_line(ln) for ln in near if ln) if v), "")
    cat = "축제" if re.search(r"축제|페스티벌|문화제|야행|페스타", title) else \
          "전시" if re.search(r"전시|展|특별전|기획전", title) else \
          "공연" if re.search(r"공연|음악회|콘서트|연주|버스킹|소리극|연극|뮤지컬", title + text[:300]) else "행사"
    return [{"title": title, "category": cat, "venue": venue[:60], "start": per[0], "end": per[1], "time": per[2], "url": url}]


def caption_lines(cap):
    """캡션 → 줄 목록(해시태그 줄은 뺀다). 수집과 다시 읽기(tools/reextract_instagram.py)가 같은 규칙을 쓴다"""
    return [ln.strip() for ln in (cap or "").replace("#", "\n#").split("\n") if ln.strip() and not ln.strip().startswith("#")]


def third_party_roundup(lines, author, handle):
    """글쓴이가 이 계정이 아니고 날짜 줄이 3개 이상이면, 다른 계정이 여러 행사를 묶어 소개한 글로 본다"""
    if not author or author.strip().lower() == (handle or "").strip().lower():
        return False
    return sum(1 for ln in lines if DATE_LINE.search(ln) and not SIGNUP.search(ln)) >= 3


async def collect_account(page, db, account, published, seen, max_age_days=21, dry=False):
    """한 계정의 새 게시물을 읽어 행사 후보를 REVIEW 로 쌓는다. 반환: (새 게시물 수, 후보 수, 후보 목록)"""
    handle, role, region = account["handle"], account.get("role") or "", account.get("region") or ""
    done = set(seen.get(handle, []))
    posts = await list_posts(page, handle)
    found, n_new = [], 0
    stale = (date.today().toordinal() - 31)  # 끝난 지 한 달 넘은 행사는 후보로 쌓지 않는다
    for idx, (code, posted) in enumerate(posts):
        if code in done:
            continue
        done.add(code)
        if posted and (date.today() - posted).days > max_age_days:
            continue
        n_new += 1
        author, cap = await fetch_caption(page, code)
        await asyncio.sleep(1.5)
        for m in set(MENTION.findall(cap or "")):  # 리포스트 출처·협업 계정은 관련 계정 후보가 된다
            if m.lower() != handle.lower():
                cands = seen.setdefault("_mentions", {})
                cands[m] = cands.get(m, 0) + (2 if role in ("official", "group") else 1)  # 기관·단체가 언급한 계정 우선
        if not cap or NOT_EVENT.search(cap[:200]):
            continue
        url = f"https://www.instagram.com/p/{code}/"
        lines = caption_lines(cap)
        if third_party_roundup(lines, author, handle):
            continue   # 다른 계정이 여러 공연을 묶어 소개한 글(공동 게시). 행사는 주최 계정의 글로 잡힌다
        evs = extract_post_event(lines, posted or date.today(), url)
        if not evs and EVENT_WORDS.search(cap) and idx < 6:
            # 날짜가 캡션에 없고 포스터에만 있는 경우. 게시일을 알 수 없어 최근 6개 게시물만 남기고,
            # 검토 때 이미지를 보고 날짜를 넣는다
            head = next((ln for ln in lines if len(re.sub(r"[^\w가-힣]", "", ln)) >= 4), "")
            evs = [{"title": head[:80], "category": "행사", "venue": "", "start": "", "end": "",
                    "time": "", "url": url, "image_only": True}]
        evs = [e for e in evs if not e["end"] or date.fromisoformat(e["end"]).toordinal() >= stale]
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
            # save_raw_post 는 상태를 COLLECTED 로 덮어쓴다. 그대로 두면 정기 자동 공개에 걸리므로 바로 REVIEW 로 돌린다
            db.supabase.table("raw_posts").update({"status": "REVIEW"}).eq("source", "인스타그램").eq("source_id", sid).execute()
    seen[handle] = sorted(done)[-200:]
    return n_new, len(found), found


# ---------- 계정 채점 (관련 계정 찾기·기존 계정 유지에 쓴다) ----------
GN = re.compile(r"경남|경상남도|창원|마산|진해|진주|통영|사천|김해|밀양|거제|양산|의령|함안|창녕|고성|남해|하동|산청|함양|거창|합천|장유|율하|"
                r"수릉원|봉황동|봉리단길|대성동|연지공원|성산아트홀|3[·.]15아트센터|문화의전당|서부문화센터|윤슬|클레이아크|가야|"
                r"영남루|촉석루|진주성|남강|돝섬|용지|가로수길|창동|오동동|통영국제음악당|금강공원")
EV = re.compile(r"축제|공연|전시|행사|페스티벌|음악회|콘서트|문화제|마켓|체험|야행|클래스|버스킹")
DT = re.compile(r"📅|🗓|일시|기간|\d{1,2}\s*[./월]\s*\d{1,2}\s*(일|\.|\(|~)")
AD = re.compile(r"협찬|광고|제작지원|#ad\b")
# 새 계정 탐색 대상(사용자 지정): 지자체·문화예술 공공기관·박물관·미술관·재단, 협회·예술단체·문화단체, 예술단체 대표·실무자 개인
OFFICIAL = re.compile(r"시청|군청|도청|구청|읍사무소|행정복지센터|재단|문화원|문화회관|예술회관|아트센터|문화의전당|미술관|박물관|"
                      r"기념관|도서관|문화센터|청소년센터|조직위|축제|진흥원|문화도시")
GROUP = re.compile(r"협회|예총|연합회|예술단|극단|무용단|합창단|오케스트라|앙상블|국악단|국악원|풍물|농악|밴드|보존회|"
                   r"갤러리|소극장|창작소|레지던시|문화공간|복합문화|협동조합|공방|컴퍼니|프로젝트|문화단체|예술단체|동아리")
HANDLE_ART = re.compile(r"gugak|busk|piano|violin|cello|gayageum|haegeum|pansori|sori|dance|ballet|theat|"
                        r"actor|singer|band|music|art|gallery|studio|craft|ceramic|potter", re.I)
ARTIST = re.compile(r"대표|감독|연출|단장|단원|기획자|문화기획|큐레이터|작가|배우|무용가|안무|연주자|피아니스트|바이올리니스트|"
                    r"첼리스트|소리꾼|가수|싱어송라이터|뮤지션|화가|도예가|공예가|사진가|예술가|아티스트|강사")


def _followers(s):
    m = re.search(r"팔로워\s*([\d.,]+)\s*(만|천)?", s)
    if not m:
        return 0
    n = float(m.group(1).replace(",", ""))
    return int(n * (10000 if m.group(2) == "만" else 1000 if m.group(2) == "천" else 1))


async def score_profile(page, handle):
    """로그인 세션으로 프로필 최근 24개 캡션을 읽어 채점한다. 반환: dict 또는 None(없는 계정)"""
    await page.goto(f"https://www.instagram.com/{handle}/", wait_until="domcontentloaded")
    await page.wait_for_timeout(3500)
    header = await page.query_selector("header")
    if not header:
        return None
    htext = await header.inner_text()
    for _ in range(2):
        await page.mouse.wheel(0, 2500)
        await page.wait_for_timeout(1500)
    items = await page.eval_on_selector_all(
        'a[href*="/p/"],a[href*="/reel/"]',
        'els => els.slice(0, 24).map(e => [e.getAttribute("href"), (e.querySelector("img") || {}).alt || ""])')
    caps = [a for _, a in items]
    newest = None
    if items:  # 가장 최근 게시물(고정 게시물 3개를 피해 앞 4개 중 가장 최근)의 게시 시각
        dates = []
        for href, _ in items[:4]:
            await page.goto("https://www.instagram.com" + href, wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            t = await page.get_attribute("time[datetime]", "datetime")
            if t:
                dates.append(t[:10])
        newest = max(dates) if dates else None
    n = len(caps) or 1
    gn = sum(1 for c in caps if GN.search(c))
    ev = sum(1 for c in caps if EV.search(c) and DT.search(c))
    ad = sum(1 for c in caps if AD.search(c))
    fol = _followers(htext)
    recent = bool(newest) and (date.today() - date.fromisoformat(newest)).days <= 35
    lines = [ln for ln in htext.split("\n") if ln.strip()]
    name = lines[1] if len(lines) > 1 else handle
    bio = htext[:400]
    kind = "official" if OFFICIAL.search(bio) else "group" if GROUP.search(bio) else "artist" if ARTIST.search(bio) else \
        "artist" if HANDLE_ART.search(handle) else None
    score = round(max(gn / n * 40 + min(ev, 12) / 12 * 40 + (10 if fol >= 10000 else 5 if fol >= 1000 else 0)
                      + (10 if recent else 0) - min(ad / n * 40, 40), 0))
    # 기관은 경남 비중 50% 이상. 단체·개인은 여러 지역에서 활동하므로 비율 대신 경남 게시물 4개 이상.
    # 셋 다 행사 게시물 2개 이상, 5주 내 활동
    gn_ok = gn / n >= .5 if kind == "official" else gn >= 4
    passed = kind is not None and gn_ok and ev >= 2 and ad / n <= .25 and recent
    # 기존 정보제공(인플루언서) 계정의 유지 판정에만 쓴다. 새 인플루언서는 탐색 대상이 아니다
    passed_inf = gn / n >= .5 and ev >= 5 and ad / n <= .25 and recent
    detail = (f"{ {'official': '기관', 'group': '단체', 'artist': '예술인'}.get(kind, '분류 안 됨') } · "
              f"최근 {len(caps)}개 중 경남 {gn}·날짜+행사 {ev}·광고 {ad}, 팔로워 {fol:,}, "
              f"최근게시 {newest or '?'} ({date.today().isoformat()} 채점)")
    return {"handle": handle, "name": name[:40], "score": score, "detail": detail, "kind": kind,
            "role": kind if passed else None, "informant_ok": passed_inf,
            "gn": gn, "ev": ev, "ad": ad, "n": len(caps), "followers": fol, "recent": recent}
