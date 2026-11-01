"""정의 파일을 저장 없이 실행해 본다: 게시판별 건수, 날짜 파싱률, 앞의 몇 건.

사용: python tools/try_source.py <slug> [<slug> ...]   (slug 없이 실행하면 전체)
"""
import asyncio
import os
import sys

import aiohttp

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from public_scraper import PublicScraper, UA  # noqa: E402
from source_loader import load_all  # noqa: E402


async def main(slugs):
    defs = [d for d in load_all() if not slugs or d["slug"] in slugs]
    scraper = PublicScraper(db=None)
    async with aiohttp.ClientSession(headers=UA) as session:
        for d in defs:
            for board in d["boards"]:
                try:
                    items = await scraper._list_items(session, d, board)
                except Exception as e:
                    print(f"[{d['slug']}] {board['category']} ❌ {type(e).__name__}: {e}")
                    continue
                parsed = sum(1 for i in items if i["period"]["parsed"])
                nov = sum(1 for i in items if i["period"]["parsed"] and i["period"]["end"] >= "2026-11-01")
                print(f"[{d['slug']}] {board['category']} {len(items)}건, 날짜 {parsed}/{len(items)}, 11월 이후 {nov}")
                for i in items[:3]:
                    p = i["period"]
                    print(f"    {i['title'][:36]} | {p['start']}~{p['end']} ({p['raw'][:30]}) | {i.get('venue','')[:15]} | id={i.get('id')} | {i['link']}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
