"""공개 행사의 장소를 건물 단위 venues 로 묶고 좌표를 채운다 (specs/002-nearby-events, contracts/venue-geocode.md).

사용 (collector 폴더에서):
  python tools/geocode_venues.py --backfill --dry-run   # 묶음·판정만 출력, DB 쓰기 없음
  python tools/geocode_venues.py --backfill             # 끝나지 않은 공개 행사 전부
  python tools/geocode_venues.py                        # venue_id 가 빈 공개 행사만 (정기 루틴)

좌표 출처: 네이버 지역 검색(NAVER API HUB, Application의 Client ID·Secret → NAVER_SEARCH_CLIENT_ID·SECRET, collector/.env). 키 값은 출력하지 않는다.
마지막 줄은 정기 루틴 알림에 붙는 보고 한 줄이다.
"""
import argparse
import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import requests

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402

load_dotenv(".env.local")
load_dotenv(".env")
from database import Database  # noqa: E402
from venue_norm import decide, naver_to_wgs84, normalize_venue, strip_html  # noqa: E402

KST = timezone(timedelta(hours=9))
# 네이버 지역 검색은 2026년 NAVER API HUB(네이버 클라우드 콘솔)로 옮겨졌다. 공식 문서: api.ncloud-docs.com/docs/naver-api-hub-search-local
NAVER_URL = "https://naverapihub.apigw.ntruss.com/search/v1/local"


def naver_search(query: str) -> list:
    cid, sec = os.getenv("NAVER_SEARCH_CLIENT_ID"), os.getenv("NAVER_SEARCH_CLIENT_SECRET")
    r = requests.get(NAVER_URL, params={"query": query, "display": 5, "format": "json"},
                     headers={"X-NCP-APIGW-API-KEY-ID": cid, "X-NCP-APIGW-API-KEY": sec}, timeout=15)
    r.raise_for_status()
    out = []
    for it in r.json().get("items", []):
        ll = naver_to_wgs84(it.get("mapx"), it.get("mapy"))
        out.append({"name": strip_html(it.get("title", "")),
                    "address": it.get("roadAddress") or it.get("address") or "",
                    "lat": ll[0] if ll else None, "lng": ll[1] if ll else None})
    return out


def load_events(db, only_unlinked: bool) -> list:
    today = datetime.now(KST).date().isoformat()
    q = (db.supabase.table("events").select("id,venue,region")
         .eq("status", "PUBLISHED").gte("event_date_end", today))
    if only_unlinked:
        q = q.is_("venue_id", "null")
    rows, start = [], 0
    while True:
        page = q.range(start, start + 999).execute().data
        rows += page
        if len(page) < 1000:
            return rows
        start += 1000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--sleep", type=float, default=0.15, help="검색 호출 사이 쉬는 초")
    a = ap.parse_args()

    has_key = bool(os.getenv("NAVER_SEARCH_CLIENT_ID") and os.getenv("NAVER_SEARCH_CLIENT_SECRET"))
    db = Database()
    try:
        existing = db.supabase.table("venues").select("id,name,region,aliases,geo_status").execute().data
    except Exception as e:
        if a.dry_run:
            existing = []
        else:
            print(f"⏭️ 장소 좌표: venues 표 없음(마이그레이션 미적용) — {type(e).__name__}")
            return

    by_key = {(v["name"], v["region"]): v for v in existing}
    by_alias = {}
    for v in existing:
        for al in v.get("aliases") or []:
            by_alias[(al, v["region"])] = v

    events = load_events(db, only_unlinked=not a.backfill)
    groups = defaultdict(lambda: {"aliases": set(), "events": []})
    skipped_empty = 0
    for e in events:
        raw = (e.get("venue") or "").strip()
        if not raw:
            skipped_empty += 1
            continue
        key = (normalize_venue(raw), e.get("region"))
        groups[key]["aliases"].add(raw)
        groups[key]["events"].append(e["id"])

    stat = defaultdict(int)
    now = datetime.now(KST).isoformat(timespec="seconds")
    for (name, region), g in sorted(groups.items()):
        v = by_key.get((name, region)) or next((by_alias[(al, region)] for al in g["aliases"] if (al, region) in by_alias), None)
        status, top, cands = (v or {}).get("geo_status"), None, None
        if v is None or status == "pending" and v.get("candidates") is None:
            stat["new" if v is None else "retry"] += 1
            if not has_key:
                status = "pending"
            else:
                try:
                    cands = naver_search(f"{name} {region or ''}".strip())
                    time.sleep(a.sleep)
                except Exception as ex:
                    stat["search_error"] += 1
                    print(f"  ! 검색 실패 {name}: {type(ex).__name__}")
                    cands = None
                if cands is not None:
                    status, top = decide(name, region or "", cands)
        stat[status or "pending"] += 1
        if a.dry_run:
            print(f"{status or 'pending':9} {region or '-':4} {name}  ← {len(g['aliases'])}표기·행사 {len(g['events'])}"
                  + (f"  → {top['name']} ({top['lat']:.5f},{top['lng']:.5f}) {top['address']}" if top else ""))
            continue
        row = {"name": name, "region": region,
               "aliases": sorted(set((v or {}).get("aliases") or []) | g["aliases"])}
        if cands is not None:
            row["geo_status"] = status
            row["candidates"] = cands[:3] if status == "pending" else None
            if top:
                row.update({"lat": top["lat"], "lng": top["lng"], "address": top["address"],
                            "geo_source": "naver", "checked_by": "auto", "checked_at": now})
        if v:
            db.supabase.table("venues").update(row).eq("id", v["id"]).execute()
            vid = v["id"]
        else:
            vid = db.supabase.table("venues").insert(row).execute().data[0]["id"]
        for i in range(0, len(g["events"]), 100):
            db.supabase.table("events").update({"venue_id": vid}).in_("id", g["events"][i:i + 100]).execute()
        stat["linked"] += len(g["events"])

    key_note = "" if has_key else " · 네이버 검색 키 없음(좌표 미조회)"
    print(f"{'[미리보기] ' if a.dry_run else ''}장소 {len(groups)}곳(새 {stat['new']}) · 자동 확정 {stat['confirmed']}"
          f" · 확인 대기 {stat['pending']} · 실패 {stat['failed']} · 연결한 행사 {stat['linked']}"
          f" · 장소 없는 행사 {skipped_empty}{key_note}" + (f" · 검색 오류 {stat['search_error']}" if stat["search_error"] else ""))


if __name__ == "__main__":
    main()
