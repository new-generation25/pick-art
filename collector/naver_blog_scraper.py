"""네이버 블로그(지자체 공식 블로그)에서 행사 일정을 읽는다.

RSS 로 최근 글을 받고, 글 본문에서 '제목 줄 → 📅 날짜 줄 → 📍 장소 줄' 묶음을 행사로 뽑는다.
월간 "○월엔, ○○에서 만나요" 모음 글이 주 대상이다. 관람 후기처럼 📅 줄이 없는 글은 건너뛴다.
로그인 없이 동작한다(rss.blog.naver.com, blog.naver.com/PostView.naver).
"""
import hashlib
import html
import re
from datetime import date
from email.utils import parsedate_to_datetime

import aiohttp

UA = {"User-Agent": "Mozilla/5.0"}
DATE_MARK = re.compile(r"^(📅|🗓|📆)|^(일시|기간|일정|행사일시|축제 ?기간)\s*[:：]?")
PLACE_MARK = re.compile(r"^(📍|🏛|🎪)|^(장소|행사장소|축제 ?장소)\s*[:：]?")
TIME_MARK = re.compile(r"^⏰")
ROUNDUP = re.compile(r"축제·문화행사|문화행사 모음|행사 모음")
EXCLUDE = re.compile(r"채용|모집|신청기간|접수기간|응모|설문|이벤트 ?기간|홈경기|vs|체육대회|정례조회|간부회의|구독|학술회의|특강")
CATEGORY = [("축제|페스타|페스티벌|야행|문화제|예술제|축전", "축제"),
            ("음악회|콘서트|가요제|공연|연주회|뮤지컬|연극|오광대|국악|무용", "공연"),
            ("전시|展|사진전|미술전|특별전|기획전", "전시")]

# 11.6.(금) / 2026. 11. 7.(토) / 10월 30일(금)
MD = re.compile(r"(?:(20\d\d)\s*[.년]\s*)?(\d{1,2})\s*(?:[./]|월)\s*(\d{1,2})\s*(?:일|\.)?")


def _clean(s):
    s = re.sub(r"^[^\w〈<'\"(\[]+", "", s)  # 앞쪽 이모지·기호
    return re.sub(r"\s+", " ", s).strip()


def parse_period(line, ref: date):
    """날짜 줄에서 (시작, 끝, 시간) 을 뽑는다. 연도가 없으면 글 작성일 기준으로 정한다."""
    body = DATE_MARK.sub("", line).strip()
    found = []
    for m in MD.finditer(body):
        y, mo, d = m.group(1), int(m.group(2)), int(m.group(3))
        if not (1 <= mo <= 12 and 1 <= d <= 31):
            continue
        if y:
            yy = int(y)
        else:
            yy = found[-1].year if found else ref.year
            if not found and mo < ref.month - 6:
                yy += 1
            if found and (mo, d) < (found[-1].month, found[-1].day):
                yy += 1
        try:
            found.append(date(yy, mo, d))
        except ValueError:
            continue
        if len(found) == 2:
            break
    if not found:
        return None
    t = re.search(r"\d{1,2}:\d{2}\s*(?:~\s*\d{1,2}:\d{2})?", body)
    return found[0].isoformat(), found[-1].isoformat(), t.group(0) if t else ""


def extract_events(lines, ref: date, url: str):
    out = []
    for i, ln in enumerate(lines):
        if not DATE_MARK.search(ln):
            continue
        per = parse_period(ln, ref)
        if not per:
            continue
        # 제목: 위로 올라가며 표지 줄이 아닌 첫 줄
        title = ""
        for j in range(i - 1, max(i - 4, -1), -1):
            c = lines[j]
            if DATE_MARK.search(c) or PLACE_MARK.search(c) or TIME_MARK.search(c):
                break
            if len(_clean(c)) >= 4:
                title = _clean(c)
                # 부제(따옴표 줄) 바로 위에 본 제목이 있으면 합친다
                if j > 0 and re.match(r"^['\"‘“〈<]", c) and len(_clean(lines[j - 1])) >= 4 \
                        and not (DATE_MARK.search(lines[j - 1]) or PLACE_MARK.search(lines[j - 1])):
                    title = f"{_clean(lines[j - 1])} {title}"
                break
        if not title or EXCLUDE.search(title):
            continue
        venue, time_ = "", per[2]
        for c in lines[i + 1:i + 4]:
            if PLACE_MARK.search(c) and not venue:
                venue = _clean(PLACE_MARK.sub("", c))
            elif TIME_MARK.search(c) and not time_:
                time_ = _clean(TIME_MARK.sub("", c))
            elif DATE_MARK.search(c):
                break
        cat = next((v for k, v in CATEGORY if re.search(k, title)), "행사")
        out.append({"title": title, "category": cat, "venue": venue, "start": per[0], "end": per[1],
                    "time": time_, "url": url})
    return out


async def fetch_posts(session, blog_id, limit=50):
    async with session.get(f"https://rss.blog.naver.com/{blog_id}.xml", headers=UA) as r:
        rss = await r.text()
    posts = []
    for it in rss.split("<item>")[1:limit + 1]:
        link = re.search(r"<link>(.*?)</link>", it, re.S).group(1)
        no = re.search(r"(\d{9,})", link).group(1)
        pub = parsedate_to_datetime(re.search(r"<pubDate>(.*?)</pubDate>", it).group(1)).date()
        title = re.sub(r"<!\[CDATA\[|\]\]>", "", re.search(r"<title>(.*?)</title>", it, re.S).group(1)).strip()
        posts.append({"no": no, "pub": pub, "title": title, "url": f"https://blog.naver.com/{blog_id}/{no}"})
    return posts


async def fetch_lines(session, blog_id, no):
    url = f"https://blog.naver.com/PostView.naver?blogId={blog_id}&logNo={no}"
    async with session.get(url, headers=UA) as r:
        raw = await r.text()
    i = raw.find("se-main-container")
    body = raw[i:] if i > 0 else raw
    lines = []
    for m in re.finditer(r'<p[^>]*class="se-text-paragraph[^"]*"[^>]*>(.*?)</p>', body, re.S):
        t = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).replace("​", "").strip()
        if t:
            lines.append(t)
    return lines


def _norm(title):
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)|[<>《》〈〉\"'‘’“”]", "", title or "")
    return re.sub(r"[\s·,.:\-_~!?&]", "", t).lower()


async def scrape_blog(blog_id, region, source_name, db=None, limit=50):
    """블로그 글에서 행사를 뽑아 raw_posts 에 넣는다. db 가 없으면 뽑은 목록만 돌려준다(dry-run)."""
    found, new, dup = [], 0, 0
    # 이미 공개된 행사와 같은 날 시작하고 제목 한쪽이 다른 쪽을 포함하면 같은 행사로 본다
    # (블로그는 '준공식 및 부곡주민 어울림축제'처럼 다른 출처보다 제목을 길게 쓴다)
    published = {}
    if db is not None:
        for ev in db.supabase.table("events").select("title,event_date_start").execute().data:
            published.setdefault(ev["event_date_start"], []).append(_norm(ev["title"]))
    async with aiohttp.ClientSession() as session:
        for p in await fetch_posts(session, blog_id, limit):
            # 단일 행사 소개 글은 세부 프로그램·교통통제 줄까지 📅 로 적어 오탐이 많다. 월간 모음 글만 읽는다
            if not ROUNDUP.search(p["title"]):
                continue
            lines = await fetch_lines(session, blog_id, p["no"])
            for e in extract_events(lines, p["pub"], p["url"]):
                e["post"] = p["title"]
                found.append(e)
                if db is None:
                    continue
                n = _norm(e["title"])
                if any(n in p or p in n for p in published.get(e["start"], []) if p):
                    dup += 1
                    continue
                sid = hashlib.sha1(f"{e['title']}|{e['start']}".encode()).hexdigest()[:16]
                if db.check_duplicate_source(source_name, sid):
                    dup += 1
                    continue
                post = {
                    "source": source_name, "source_id": sid, "source_url": e["url"],
                    "content": {"title": e["title"], "description": "",
                                "ai_suggestion": {"category": e["category"], "region": region, "venue": e["venue"],
                                                  "date_start": e["start"], "date_end": e["end"], "date_parsed": True,
                                                  "price": "", "time": e["time"], "extracted_by": "naver_blog",
                                                  "evidence": f"{source_name} 글 '{p['title']}' ({p['pub']})"}},
                    "image_urls": [], "status": "COLLECTED",
                }
                if db.save_raw_post(post):
                    new += 1
    return {"found": found, "new": new, "dup": dup}
