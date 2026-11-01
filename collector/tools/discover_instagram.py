"""인스타그램 계정 유지 + 관련 계정 찾기 (매일).

사용: python tools/discover_instagram.py [--dry-run] [--max-new=15] [--max-rescore=10]
- 유지: whitelist 인스타그램 계정 중 채점한 지 오래된 것부터 max-rescore 개를 다시 채점해 score·score_detail 을 갱신한다.
  인플루언서(informant)·단체(group)·예술인(artist)이 두 번 연속 기준 미달이면 role='dormant' 로 바꿔 수집에서 뺀다
  (지우지 않는다). 기관(official)은 휴면시키지 않는다.
- 찾기(대상: 지자체·문화예술 공공기관·박물관·미술관·재단 / 협회·예술단체·문화단체 / 예술단체 대표·실무자 개인):
  후보 = (1) 수집 중 캡션에 나온 @계정(기관·단체가 언급하면 가중치 2) (2) 그날 차례인 예술 해시태그 4개의 게시물 작성자.
  whitelist 에 없고 최근 30일 안에 떨어진 적 없는 후보를 많이 나온 순으로 max-new 개 채점한다.
  프로필 이름·소개로 official / group / artist 를 가르고, 경남 비중(기관 ≥50%, 단체·개인 ≥30%),
  날짜+행사 게시물 ≥2/24, 광고 ≤25%, 5주 내 게시를 넘으면 그 역할로 whitelist 에 넣는다.
  셋 어디에도 해당하지 않는 계정(맛집·여행 인플루언서 등)은 넣지 않는다.
- 팔로우는 하지 않는다(짧은 시간에 많이 하면 계정이 제한된다). 로그인 세션은 collect_instagram.py --login 으로 만든다.
"""
import asyncio
import json
import os
import re
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from playwright.async_api import async_playwright  # noqa: E402
from database import Database  # noqa: E402
from insta_browser_scraper import UA, load_seen, save_seen, score_profile  # noqa: E402
from collect_instagram import PROFILE_DIR, arg, logged_in  # noqa: E402

STATE = os.path.join(".cache", "insta_discover.json")
# 탐색 대상: 지자체·문화예술 기관·박물관·미술관·재단, 협회·예술단체·문화단체, 예술단체 대표·실무자 (예술 쪽 해시태그)
TAGS = ["경남연극", "김해연극", "창원연극", "진주연극", "통영연극", "김해공연", "창원공연", "진주공연", "경남공연",
        "김해전시", "창원전시", "진주전시", "경남미술", "경남국악", "김해국악", "경남무용", "창원무용", "경남음악",
        "경남버스킹", "김해버스킹", "창원버스킹", "경남예술", "김해예술", "경남문화예술", "경남작가", "김해작가",
        "경남합창단", "창원오케스트라", "경남갤러리", "김해갤러리", "창원갤러리", "경남공예", "김해공방"]
SKIP_HANDLES = {"p", "reel", "explore", "accounts", "stories"}


def load_state():
    try:
        return json.load(open(STATE, encoding="utf-8"))
    except (OSError, ValueError):
        return {"rejected": {}, "scored_at": {}, "fails": {}}


async def tag_authors(page, tag, limit=30):
    """해시태그 검색 결과 게시물의 작성자. 게시물 페이지를 열어 작성자 링크를 읽는다."""
    await page.goto(f"https://www.instagram.com/explore/search/keyword/?q=%23{tag}", wait_until="domcontentloaded")
    await page.wait_for_timeout(4000)
    codes = await page.eval_on_selector_all('a[href*="/p/"],a[href*="/reel/"]', 'els => els.map(e => e.getAttribute("href"))')
    codes = list(dict.fromkeys(re.search(r"/(?:p|reel)/([\w-]+)/", c).group(1) for c in codes if re.search(r"/(?:p|reel)/([\w-]+)/", c)))
    authors = {}
    for code in codes[:limit]:
        await page.goto(f"https://www.instagram.com/p/{code}/embed/captioned/", wait_until="domcontentloaded")
        u = await page.evaluate("() => { const e = document.querySelector('.UsernameText'); return e ? e.innerText : null; }")
        if u:
            authors[u] = authors.get(u, 0) + 1
        await page.wait_for_timeout(1200)
    return authors


async def main(dry):
    db = Database()
    st, seen = load_state(), load_seen()
    today = date.today()
    wl = db.supabase.table("whitelist").select("id,value,name,role,score").eq("type", "instagram").execute().data
    known = {w["value"].rstrip("/").split("/")[-1].lower(): w for w in wl}
    max_new, max_re = int(arg("max-new") or 15), int(arg("max-rescore") or 10)
    log = {"rescored": [], "dormant": [], "added": [], "rejected": []}

    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(PROFILE_DIR, headless=True, locale="ko-KR", user_agent=UA)
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        if not await logged_in(ctx):
            print("⚠️ 로그인 세션이 없다. python tools/collect_instagram.py --login")
            await ctx.close()
            return

        # 1) 유지: 오래 채점 안 한 계정부터 다시 채점
        order = sorted(known, key=lambda h: st["scored_at"].get(h, ""))
        for h in [h for h in order if known[h].get("role") != "dormant"][:max_re]:
            r = await score_profile(page, h)
            st["scored_at"][h] = today.isoformat()
            if not r:
                log["rescored"].append(f"{h}: 프로필 없음")
                continue
            w = known[h]
            upd = {"score": r["score"], "score_detail": r["detail"]}
            role = w.get("role")
            # 기관(official)은 휴면시키지 않는다. 인플루언서는 기존 정보제공 기준, 단체·예술인은 탐색 기준으로 본다
            failed = (role == "informant" and not r["informant_ok"]) or (role in ("group", "artist") and not r["role"])
            if failed:
                st["fails"][h] = st["fails"].get(h, 0) + 1
                if st["fails"][h] >= 2:
                    upd["role"] = "dormant"
                    upd["score_detail"] = "두 번 연속 기준 미달로 휴면: " + r["detail"]
                    log["dormant"].append(h)
            else:
                st["fails"].pop(h, None)
            if not dry:
                db.supabase.table("whitelist").update(upd).eq("id", w["id"]).execute()
            log["rescored"].append(f"{h}: {w.get('score')}→{r['score']}")
            await asyncio.sleep(3)

        # 2) 찾기: 캡션 @언급 + 그날 차례인 해시태그 작성자
        cands = dict(seen.get("_mentions", {}))
        start = (today.toordinal() * 4) % len(TAGS)
        for tag in [TAGS[(start + i) % len(TAGS)] for i in range(4)]:
            for u, c in (await tag_authors(page, tag)).items():
                cands[u] = cands.get(u, 0) + c
        cutoff = (today - timedelta(days=30)).isoformat()
        pool = [h for h, _ in sorted(cands.items(), key=lambda x: -x[1])
                if h.lower() not in known and h.lower() not in SKIP_HANDLES and st["rejected"].get(h.lower(), "") < cutoff]
        for h in pool[:max_new]:
            r = await score_profile(page, h)
            if not r or not r["role"]:
                st["rejected"][h.lower()] = today.isoformat()
                log["rejected"].append(f"{h} ({r['score'] if r else '없음'})")
                continue
            if not dry:
                db.supabase.table("whitelist").insert({
                    "type": "instagram", "value": f"https://www.instagram.com/{h}/", "name": r["name"],
                    "auto_publish": False, "schedule": "daily", "role": r["role"], "score": r["score"],
                    "score_detail": "자동 발견: " + r["detail"]}).execute()
            st["scored_at"][h.lower()] = today.isoformat()
            log["added"].append(f"{h} [{r['role']}] {r['score']}점 {r['name']}")
            await asyncio.sleep(3)
        await ctx.close()

    if not dry:
        seen["_mentions"] = {}  # 확인한 언급은 비운다(다음 수집에서 다시 쌓인다)
        save_seen(seen)
        os.makedirs(".cache", exist_ok=True)
        json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"유지: 재채점 {len(log['rescored'])}, 휴면 {len(log['dormant'])} | 찾기: 후보 {len(pool)}, "
          f"추가 {len(log['added'])}, 탈락 {len(log['rejected'])}")
    for k in ("added", "dormant", "rescored", "rejected"):
        for x in log[k]:
            print(f"  [{k}] {x}")


if __name__ == "__main__":
    asyncio.run(main("--dry-run" in sys.argv))
