"""포스터 자리가 «안내 그림»인 공개 행사의 진짜 포스터를 원본 안내 페이지 본문에서 찾아 채운다 (specs/014 보완).

김해 기관 누리집(ghct)은 목록·포스터 칸에 «공연 이미지 준비 중» 그림(sample.jpg)을 두고, 실제 포스터는 상세 본문에 올린다.
수집 때는 포스터 칸만 읽어서 안내 그림이 저장됐다. 이 도구는 사이트 정의 파일(sources/*.json)의 detail.body 안
첫 이미지를 받아, 지문이 안내 그림이 아니면 포스터로 바꾼다(헌장 I: 공식 페이지의 원본 이미지만 쓴다).
정의에 detail.body 가 없는 출처는 건너뛴다(사이트별 코드를 넣지 않는다, 헌장 IV).

쓰기는 collector/.env.local 의 service 키. 키는 출력하지 않는다.
사용(collector 폴더에서, 마지막 줄이 한 줄 요약):
  python tools/refill_placeholder_posters.py            미리보기
  python tools/refill_placeholder_posters.py --apply    적용
"""
import argparse
import asyncio
import hashlib
import os
import sys
from urllib.parse import urljoin

import aiohttp
from bs4 import BeautifulSoup

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402
from source_loader import find_for_url  # noqa: E402
from utils import process_and_upload_image  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (compatible; pica-collector)"}


async def first_body_image(session, url, body_sel):
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as r:
        if r.status != 200:
            return None
        html = await r.text(errors="replace")
    soup = BeautifulSoup(html, "html.parser")
    body = soup.select_one(body_sel)
    if not body:
        return None
    for img in body.select("img[src]"):
        src = img.get("src") or ""
        if src.startswith("data:"):
            continue
        return urljoin(url, src)
    return None


async def main(apply):
    db = Database()
    sb = db.supabase
    placeholders = {r["sha256"] for r in sb.table("placeholder_images").select("sha256").execute().data}
    rows = (sb.table("events").select("id,title,original_url,raw_post_id,source")
            .eq("status", "PUBLISHED").eq("poster_placeholder", True).execute().data)
    found = skipped_nodef = none = same = 0
    async with aiohttp.ClientSession(headers=UA) as session:
        for e in rows:
            d = find_for_url(e.get("original_url") or "")
            body_sel = ((d or {}).get("detail") or {}).get("body")
            if not body_sel:
                skipped_nodef += 1
                continue
            try:
                img = await first_body_image(session, e["original_url"], body_sel)
            except Exception as ex:  # 한 건 실패해도 계속
                print(f"  실패 {e['title'][:30]}: {type(ex).__name__}")
                img = None
            if not img:
                none += 1
                print(f"  본문 그림 없음: {e['title'][:40]}")
                continue
            async with session.get(img, timeout=aiohttp.ClientTimeout(total=30)) as r:
                data = await r.read() if r.status == 200 else b""
            if not data or hashlib.sha256(data).hexdigest() in placeholders:
                same += 1
                continue
            found += 1
            print(f"  포스터 찾음: {e['title'][:40]} ← {img}")
            if apply:
                key = f"refill_{hashlib.sha1(e['id'].encode()).hexdigest()[:12]}"
                _, url, _ = await process_and_upload_image(sb, img, key)
                if not url:
                    continue
                stored = await (await session.get(url)).read()
                sb.table("events").update({"poster_image_url": url, "poster_sha256": hashlib.sha256(stored).hexdigest()}).eq("id", e["id"]).execute()
                if e.get("raw_post_id"):
                    sb.table("raw_posts").update({"image_urls": [url]}).eq("id", e["raw_post_id"]).execute()
    print(f"안내 그림 포스터 바꾸기{'(적용)' if apply else '(미리보기)'}: 대상 {len(rows)}건 · 찾음 {found} · 본문 그림 없음 {none} · "
          f"본문도 안내 그림 {same} · 정의에 본문 없음 {skipped_nodef}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    asyncio.run(main(ap.parse_args().apply))
