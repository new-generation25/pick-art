"""포스터 자리가 «안내 그림»인 공개 행사의 진짜 포스터를 원본 안내 페이지에서 찾아 채운다 (specs/014 보완).

김해 기관 누리집(ghct)·통영·함양 공연장은 목록·포스터 칸에 «공연 이미지 준비 중» 같은 안내 그림을 두고, 실제 포스터는
나중에 상세 페이지에 올린다. 어디서 찾을지는 사이트 정의 파일(sources/*.json)의 detail.poster(포스터 선택자)와
detail.body(본문 첫 이미지)에만 적는다(poster_finder.py, 사이트별 코드 없음 — 헌장 IV). 후보 가운데 지문이 안내 그림이
아닌 첫 이미지를 포스터로 바꾼다(헌장 I: 공식 페이지의 원본 이미지만 쓴다). 정기 루틴(main.py)이 매일 돌려서,
공개 뒤에 공연장이 포스터를 올려도 잡힌다. 정의에 둘 다 없는 출처는 건너뛴다.

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
from poster_finder import has_poster_rule, is_placeholder, load_placeholders, poster_candidates  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (compatible; pica-collector)"}


async def find_poster(session, url, detail, placeholders):
    """상세 페이지의 후보를 차례로 받아, 안내 그림이 아닌 첫 이미지 주소. (주소, 후보 수, 안내 그림 수)"""
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as r:
        if r.status != 200:
            return None, 0, 0
        html = await r.text(errors="replace")
    cands = poster_candidates(BeautifulSoup(html, "html.parser"), url, detail)
    ph = 0
    for img in cands:
        try:
            async with session.get(img, timeout=aiohttp.ClientTimeout(total=30)) as r:
                data = await r.read() if r.status == 200 else b""
        except Exception:
            continue
        if not data:
            continue
        if is_placeholder(data, placeholders):
            ph += 1
            continue
        return img, len(cands), ph
    return None, len(cands), ph


async def main(apply):
    db = Database()
    sb = db.supabase
    placeholders = load_placeholders(sb)
    rows = (sb.table("events").select("id,title,original_url,raw_post_id,source")
            .eq("status", "PUBLISHED").eq("poster_placeholder", True).execute().data)
    found = skipped_nodef = none = same = 0
    async with aiohttp.ClientSession(headers=UA) as session:
        for e in rows:
            d = find_for_url(e.get("original_url") or "")
            detail = (d or {}).get("detail") or {}
            if not has_poster_rule(detail):
                skipped_nodef += 1
                continue
            try:
                img, n, ph = await find_poster(session, e["original_url"], detail, placeholders)
            except Exception as ex:  # 한 건 실패해도 계속
                print(f"  실패 {e['title'][:30]}: {type(ex).__name__}")
                img, n, ph = None, 0, 0
            if not img:
                if ph:
                    same += 1
                    print(f"  아직 안내 그림뿐: {e['title'][:40]}")
                else:
                    none += 1
                    print(f"  포스터 자리 없음: {e['title'][:40]}")
                continue
            found += 1
            print(f"  포스터 찾음: {e['title'][:40]} ← {img}")
            if apply:
                key = f"refill_{hashlib.sha1(e['id'].encode()).hexdigest()[:12]}"
                _, url, sha = await process_and_upload_image(sb, img, key)
                if not url:
                    continue
                sb.table("events").update({"poster_image_url": url, "poster_sha256": sha}).eq("id", e["id"]).execute()
                if e.get("raw_post_id"):
                    sb.table("raw_posts").update({"image_urls": [url]}).eq("id", e["raw_post_id"]).execute()
    print(f"안내 그림 포스터 바꾸기{'(적용)' if apply else '(미리보기)'}: 대상 {len(rows)}건 · 찾음 {found} · 포스터 자리 없음 {none} · "
          f"아직 안내 그림뿐 {same} · 정의에 포스터·본문 위치 없음 {skipped_nodef}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    asyncio.run(main(ap.parse_args().apply))
