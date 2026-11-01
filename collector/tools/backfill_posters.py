"""포스터 없이 저장된 수집분에 포스터를 채운다(정의 파일 출처만).

목록을 다시 읽어 같은 항목(출처+source_id)을 찾고, 이미지를 Storage에 올린 뒤
raw_posts.image_urls 와 그 원본으로 공개된 events.poster_image_url 을 갱신한다.

사용: python tools/backfill_posters.py [<slug> ...]   (slug 없이 실행하면 전체)
"""
import asyncio
import os
import sys

import aiohttp

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402
from public_scraper import PublicScraper, UA  # noqa: E402
from source_loader import load_all  # noqa: E402
from utils import process_and_upload_image  # noqa: E402


async def main(slugs):
    db = Database()
    wl = {w["value"]: w["name"] for w in db.supabase.table("whitelist").select("name,value").execute().data}
    scraper = PublicScraper(db)
    async with aiohttp.ClientSession(headers=UA) as session:
        for d in load_all():
            if slugs and d["slug"] not in slugs:
                continue
            # 수집기는 whitelist 이름을 raw_posts.source 로 쓴다
            names = {n for v, n in wl.items() if any(m in v for m in d["match"])} or {d["name"]}
            filled = missing = 0
            for board in d["boards"]:
                try:
                    items = await scraper._list_items(session, d, board)
                except Exception as e:
                    print(f"[{d['slug']}] 목록 실패: {e}")
                    continue
                lst = board.get("list") or d.get("list") or {}
                for it in items:
                    sid = str(it.get("id") or "") if (board.get("api") or lst.get("id") or lst.get("id_regex") or lst.get("id_from_title")) else ""
                    sid = sid or it["link"].rstrip("/").split("/")[-1]
                    for name in names:
                        raw = db.get_raw_post(name, sid)
                        if not raw or raw.get("image_urls"):
                            continue
                        if not it["image"]:
                            missing += 1
                            continue
                        _, url, _ = await process_and_upload_image(db.supabase, it["image"], f"{d['slug']}_{sid}")
                        if not url:
                            missing += 1
                            continue
                        db.supabase.table("raw_posts").update({"image_urls": [url]}).eq("id", raw["id"]).execute()
                        db.supabase.table("events").update({"poster_image_url": url}).eq("raw_post_id", raw["id"]).is_("poster_image_url", "null").execute()
                        filled += 1
            print(f"[{d['slug']}] 포스터 채움 {filled}, 원본에 이미지 없음/실패 {missing}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
