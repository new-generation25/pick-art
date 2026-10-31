"""사람·에이전트가 공식 페이지에서 직접 확인한 행사를 raw_posts에 넣는다.

사용: python tools/add_curated.py curated/2026-11.json
JSON: [{"title","category","region","venue","start","end","url","image"(선택),"source","evidence"}]
- url 이 실제로 열리지 않으면 넣지 않는다(실패 목록에 남김)
- start/end 는 'YYYY-MM-DD' 여야 한다
- source 는 '웹검색' / '인스타그램' 등, evidence 는 확인한 근거(공식 페이지 주소, 게시물 주소)
"""
import asyncio
import hashlib
import json
import os
import re
import sys

import aiohttp

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402
from utils import check_link, process_and_upload_image  # noqa: E402

ISO = re.compile(r"^20\d\d-\d\d-\d\d$")


async def main(path):
    entries = json.load(open(path, encoding="utf-8"))
    db = Database()
    new = dup = fail = 0
    async with aiohttp.ClientSession() as session:
        for e in entries:
            title = e["title"].strip()
            if not (ISO.match(e.get("start", "")) and ISO.match(e.get("end", ""))):
                print(f"❌ 날짜 형식 오류: {title}"); fail += 1; continue
            ok, status, _ = await check_link(session, e["url"])
            if not ok:
                print(f"❌ 링크 열리지 않음 ({status}): {title} {e['url']}"); fail += 1; continue
            source = e.get("source", "웹검색")
            source_id = hashlib.sha1(f"{title}|{e['start']}".encode()).hexdigest()[:16]
            if db.check_duplicate_source(source, source_id):
                dup += 1; continue
            p_url = None
            if e.get("image"):
                _, p_url, _ = await process_and_upload_image(db.supabase, e["image"], f"curated_{source_id}")
            post = {
                "source": source,
                "source_id": source_id,
                "source_url": e["url"],
                "content": {
                    "title": title,
                    "description": e.get("description", ""),
                    "ai_suggestion": {
                        "category": e["category"], "region": e["region"], "venue": e.get("venue", ""),
                        "date_start": e["start"], "date_end": e["end"], "date_parsed": True,
                        "price": e.get("price", ""), "time": e.get("time", ""),
                        "extracted_by": "curated", "evidence": e.get("evidence", ""),
                    },
                },
                "image_urls": [p_url] if p_url else [],
                "status": "COLLECTED",
            }
            if db.save_raw_post(post):
                new += 1; print(f"✅ {title} | {e['start']}~{e['end']} | {e['region']}")
            else:
                fail += 1
    print(f"\n큐레이션 등록: 신규 {new}, 중복 {dup}, 실패 {fail}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
