"""whitelist 의 인스타그램 계정에서 새 게시물을 읽어 행사 후보를 raw_posts(status=REVIEW)에 쌓는다.

사용: python tools/collect_instagram.py [--dry-run] [--only handle1,handle2] [--role official|informant]
- 로그인 없이 동작한다(로그아웃 브라우저로 프로필 최근 12개, embed 로 캡션). 그래서 매일 돌려야 놓치지 않는다
- 이미 읽은 게시물은 collector/.cache/insta_seen.json 에 남겨 다시 읽지 않는다
- 공개는 하지 않는다. 주간 검토: python tools/review_instagram.py
"""
import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from playwright.async_api import async_playwright  # noqa: E402
from database import Database  # noqa: E402
from insta_browser_scraper import UA, collect_account, load_seen, save_seen, _norm  # noqa: E402

PROFILE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".cache", "ig_profile")
REGIONS = "창원 진주 통영 사천 김해 밀양 거제 양산 의령 함안 창녕 고성 남해 하동 산청 함양 거창 합천".split()


async def logged_in(ctx):
    """세션 쿠키(sessionid)가 있으면 로그인 상태다(값은 읽지 않는다)."""
    return any(c["name"] == "sessionid" for c in await ctx.cookies("https://www.instagram.com"))


def arg(name):
    return next((a.split("=", 1)[1] for a in sys.argv if a.startswith(f"--{name}=")), None)


async def main(dry):
    db = Database()
    rows = db.supabase.table("whitelist").select("value,name,role").eq("type", "instagram").execute().data
    only = set((arg("only") or "").split(",")) - {""}
    role = arg("role")
    accounts = []
    for w in rows:
        h = w["value"].rstrip("/").split("/")[-1]
        if (only and h not in only) or (role and w.get("role") != role) or w.get("role") == "dormant":
            continue
        accounts.append({"handle": h, "role": w.get("role"), "name": w.get("name") or h,
                         "region": next((r for r in REGIONS if r in (w.get("name") or "")), "")})
    published = {}
    for ev in db.supabase.table("events").select("title,event_date_start").execute().data:
        published.setdefault(ev["event_date_start"], []).append(_norm(ev["title"]))
    seen = load_seen()
    total_new = total_found = 0
    async with async_playwright() as p:
        # 로그아웃 상태로 여러 계정을 읽으면 곧 로그인 화면으로 돌려보낸다(is_from_rle). --login 으로 만든 세션을 쓴다
        ctx = await p.chromium.launch_persistent_context(PROFILE_DIR, headless=True, locale="ko-KR", user_agent=UA)
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        if not await logged_in(ctx):
            print("⚠️ 인스타그램 로그인 세션이 없다. 먼저 python tools/collect_instagram.py --login 으로 한 번 로그인한다")
            await ctx.close()
            return
        for a in accounts:
            try:
                n_new, n_found, found = await collect_account(page, None if dry else db, a, published, seen, dry=dry)
            except Exception as e:  # 한 계정이 막혀도 나머지는 계속
                print(f"❌ @{a['handle']}: {e}")
                continue
            total_new += n_new
            total_found += n_found
            print(f"@{a['handle']} ({a['role']}): 새 게시물 {n_new}, 후보 {n_found}")
            for e in found:
                tag = " [포스터만]" if e.get("image_only") else ""
                print(f"   {e['start'] or '날짜?'}~{e['end']} {e['title'][:40]} | {e['venue'][:25]}{tag}")
            await asyncio.sleep(6)
        await ctx.close()
    if not dry:
        save_seen(seen)
    print(f"\n계정 {len(accounts)}개 → 새 게시물 {total_new}, 행사 후보 {total_found} (status=REVIEW)")


async def login():
    """수집 전용 브라우저 창을 띄운다. 사람이 직접 인스타그램에 로그인하고 창을 닫으면 세션이 PROFILE_DIR 에 남는다."""
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(PROFILE_DIR, headless=False, locale="ko-KR", user_agent=UA)
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        await page.goto("https://www.instagram.com/accounts/login/")
        print("열린 창에서 로그인한 뒤 창을 닫으세요(로그인 정보 저장 질문은 '정보 저장').")
        await ctx.wait_for_event("close", timeout=0)


if __name__ == "__main__":
    if "--login" in sys.argv:
        asyncio.run(login())
    else:
        asyncio.run(main("--dry-run" in sys.argv))
