"""whitelist 의 naver_blog 항목(지자체 공식 블로그)에서 행사를 읽어 raw_posts 에 넣는다.

사용: python tools/collect_naver_blog.py [--dry-run]
- whitelist: type='naver_blog', value='https://blog.naver.com/<blogId>', name=출처 이름
- 지역은 출처 이름에서 시군명을 찾고, 없으면 '경남'
- 발행은 publish_verified.py 가 맡는다(날짜·링크·중복 검사)
"""
import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402
from naver_blog_scraper import scrape_blog  # noqa: E402

REGIONS = "창원 진주 통영 사천 김해 밀양 거제 양산 의령 함안 창녕 고성 남해 하동 산청 함양 거창 합천".split()


async def main(dry):
    db = Database()
    rows = db.supabase.table("whitelist").select("value,name").eq("type", "naver_blog").execute().data
    for w in rows:
        blog_id = re.search(r"blog\.naver\.com/([\w-]+)", w["value"]).group(1)
        region = next((r for r in REGIONS if r in w["name"]), "경남")
        res = await scrape_blog(blog_id, region, w["name"], None if dry else db)
        print(f"[{w['name']}] 행사 {len(res['found'])}건 → 신규 {res['new']}, 중복 {res['dup']}")
        for e in res["found"]:
            print(f"  {e['start']}~{e['end']} [{e['category']}] {e['title']} | {e['venue']} | {e['time']}")


if __name__ == "__main__":
    asyncio.run(main("--dry-run" in sys.argv))
