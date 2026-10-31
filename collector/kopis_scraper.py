"""KOPIS(공연예술통합전산망) 공연 수집기.

KOPIS API는 제목·기간·장소·가격·포스터를 이미 구조화해서 주므로 AI를 쓰지 않는다.
원본 링크는 실제로 열리는지 확인한 것만 쓴다(예매처 → 공연장 홈페이지 → KOPIS 상세 순).
"""
import os
import re
import asyncio
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

import aiohttp
from dotenv import load_dotenv

from database import Database
from utils import check_link

load_dotenv(".env.local")
API_KEY = os.getenv("KOPIS_API_KEY")
BASE = "http://www.kopis.or.kr/openApi/restful"
KOPIS_VIEW = "https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id={}"
SIDO_CODE = os.getenv("KOPIS_SIDO_CODE", "48")          # 48 = 경상남도
REGION_FILTER = [r for r in os.getenv("KOPIS_REGION_FILTER", "").split(",") if r]  # 비우면 경남 전체

CITIES = ["창원", "김해", "진주", "양산", "거제", "통영", "사천", "밀양", "거창", "함안",
          "창녕", "고성", "하동", "합천", "남해", "함양", "산청", "의령"]
TICKET_HINTS = ["인터파크", "놀유니버스", "예스24", "YES24", "티켓링크", "멜론", "네이버", "공식", "홈페이지"]


def to_iso(d: str) -> str:
    """'2026.11.13' -> '2026-11-13'"""
    m = re.match(r"(\d{4})\.(\d{1,2})\.(\d{1,2})", d or "")
    return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else ""


def city_of(*texts) -> str:
    for t in texts:
        for c in CITIES:
            if t and c in t:
                return c
    return "기타"


def clean_venue(name):
    """KOPIS 공연장명이 '시설 (홀)' 꼴인데 홀 자리에 시설명이 또 들어간 경우를 줄인다: 'A (A )' -> 'A'"""
    name = (name or "").strip()
    if name.endswith(")"):
        for i in [k for k in range(len(name)) if name.startswith(" (", k)]:
            head, inner = name[:i].strip(), name[i + 2:-1].strip()
            if head and head == inner:
                return head
    return name


class KopisScraper:
    def __init__(self, db: Database):
        self.db = db
        self.facilities = {}

    async def _xml(self, session, path, **params):
        params["service"] = API_KEY
        async with session.get(f"{BASE}/{path}", params=params, timeout=aiohttp.ClientTimeout(total=30)) as r:
            if r.status != 200:
                return None
            return ET.fromstring(await r.text())

    async def _facility(self, session, mt10id):
        if mt10id not in self.facilities:
            root = await self._xml(session, f"prfplc/{mt10id}")
            db = root.find("db") if root is not None else None
            self.facilities[mt10id] = {
                "adres": db.findtext("adres") if db is not None else "",
                "url": (db.findtext("relateurl") or "").strip() if db is not None else "",
            }
        return self.facilities[mt10id]

    async def _best_link(self, session, relates, facility_url, mt20id):
        """열리는 링크만 고른다. 실패한 후보는 기록한다."""
        tried = []
        ordered = sorted(relates, key=lambda r: next((i for i, h in enumerate(TICKET_HINTS) if h in (r[0] or "")), 99))
        for name, url in ordered + [("공연장 홈페이지", facility_url), ("KOPIS", KOPIS_VIEW.format(mt20id))]:
            if not url:
                continue
            ok, status, final = await check_link(session, url)
            tried.append(f"{name}:{status}")
            if ok:
                return url, name, tried
        return None, None, tried

    async def scrape(self, start: str = None, end: str = None, log_id=None):
        """start/end: 'YYYYMMDD'. 기본은 오늘부터 60일. 결과 dict를 돌려준다."""
        if not API_KEY:
            return {"name": "KOPIS", "status": "FAIL", "summary": "❌ KOPIS_API_KEY 누락"}
        start = start or datetime.now().strftime("%Y%m%d")
        end = end or (datetime.now() + timedelta(days=60)).strftime("%Y%m%d")
        new = dup = fail = skipped_region = 0
        failures = []

        async with aiohttp.ClientSession() as session:
            items, page = [], 1
            while True:
                root = await self._xml(session, "pblprfr", stdate=start, eddate=end, cpage=page, rows=100, signgucode=SIDO_CODE)
                dbs = root.findall("db") if root is not None else []
                items += dbs
                if len(dbs) < 100:
                    break
                page += 1
            print(f"[KOPIS] {start}~{end} 경남 공연 {len(items)}건", flush=True)

            for idx, it in enumerate(items, 1):
                mt20id = it.findtext("mt20id")
                title = it.findtext("prfnm")
                try:
                    if self.db.check_duplicate_source("KOPIS", mt20id):
                        dup += 1
                        continue
                    root = await self._xml(session, f"pblprfr/{mt20id}")
                    d = root.find("db") if root is not None else None
                    if d is None:
                        fail += 1; failures.append(f"{title}: 상세 없음"); continue
                    fac = await self._facility(session, d.findtext("mt10id"))
                    region = city_of(fac["adres"], d.findtext("fcltynm"), title)
                    if REGION_FILTER and region not in REGION_FILTER:
                        skipped_region += 1
                        continue
                    relates = [(r.findtext("relatenm"), r.findtext("relateurl")) for r in d.findall("./relates/relate")]
                    link, link_name, tried = await self._best_link(session, relates, fac["url"], mt20id)
                    if not link:
                        fail += 1; failures.append(f"{title}: 열리는 링크 없음 ({', '.join(tried)})"); continue
                    poster = d.findtext("poster") or ""
                    post = {
                        "source": "KOPIS",
                        "source_id": mt20id,
                        "source_url": link,
                        "content": {
                            "title": title,
                            "description": (d.findtext("sty") or "").strip(),
                            "ai_suggestion": {
                                "category": "공연",
                                "genre": d.findtext("genrenm"),
                                "region": region,
                                "venue": clean_venue(d.findtext("fcltynm")),
                                "address": fac["adres"],
                                "date_start": to_iso(d.findtext("prfpdfrom")),
                                "date_end": to_iso(d.findtext("prfpdto")),
                                "time": (d.findtext("dtguidance") or "").strip(),
                                "runtime": (d.findtext("prfruntime") or "").strip(),
                                "age": (d.findtext("prfage") or "").strip(),
                                "price": (d.findtext("pcseguidance") or "").strip(),
                                "cast": (d.findtext("prfcast") or "").strip(),
                                "poster_url": poster,
                                "link_name": link_name,
                                "extracted_by": "kopis_api",
                            },
                        },
                        "image_urls": [poster] if poster else [],
                        "status": "COLLECTED",
                    }
                    if self.db.save_raw_post(post):
                        new += 1
                    else:
                        fail += 1; failures.append(f"{title}: DB 저장 실패")
                    await asyncio.sleep(0.2)
                except Exception as e:
                    fail += 1; failures.append(f"{title}: {e}")

        status = "SUCCESS" if (new or dup) else "FAIL"
        mark = "❌" if status == "FAIL" else ("⚠️" if fail else "✅")
        summary = f"{mark} KOPIS 수집 완료: 경남 {len(items)}건 (신규 {new}, 중복 {dup}, 실패 {fail}, 지역제외 {skipped_region})"
        print(f"[KOPIS] {summary}", flush=True)
        for f in failures[:20]:
            print(f"  - {f}", flush=True)
        if log_id:
            self.db.supabase.table("crawl_logs").update({
                "status": status, "result_summary": summary,
                "detailed_log": "\n".join(failures) or None,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", log_id).execute()
        return {"name": "KOPIS", "status": status, "summary": summary, "failures": failures}


if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    result = asyncio.run(KopisScraper(Database()).scrape(*args[:2]))
    print(result["summary"])
