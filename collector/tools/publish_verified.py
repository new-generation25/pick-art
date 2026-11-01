"""검증을 통과한 raw_posts 를 events 로 발행한다(관리자 인박스 승인과 같은 결과).

사용: python tools/publish_verified.py 2026-11-01 2026-11-30 [--dry-run]
검증 기준
  1. 날짜: date_start/date_end 가 YYYY-MM-DD 이고 기간이 [from, to] 와 겹친다
  2. 링크: source_url 이 지금 실제로 열린다(HTTP < 400)
  3. 중복: 제목(괄호·공백·[지역] 표기 제거)과 시작일이 같은 건은 하나만 발행한다.
     우선순위 KOPIS(가격·시간·예매처) > 기관 공식 게시판 > 큐레이션. 나머지는 raw_posts.status='DUPLICATE'
발행한 raw_posts 는 status='PUBLISHED' 로 바꾼다. 결과 목록을 JSON으로 남긴다.
"""
import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone

import aiohttp

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402
from utils import check_link  # noqa: E402

ISO = re.compile(r"^20\d\d-\d\d-\d\d$")


def norm(title: str) -> str:
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)|<|>|《|》|〈|〉|\"|'|‘|’|“|”", "", title or "")
    return re.sub(r"[\s·,.:\-_~!?]", "", t).lower()


def rank(row) -> int:
    s = row["source"]
    return 0 if s == "KOPIS" else (2 if (row["content"].get("ai_suggestion") or {}).get("extracted_by") == "curated" else 1)


async def main(date_from, date_to, dry):
    db = Database()
    rows = db.supabase.table("raw_posts").select("*").in_("status", ["COLLECTED", "PENDING"]).execute().data
    cands, skipped = [], {"날짜없음/형식오류": 0, "기간밖": 0}
    for r in rows:
        a = (r.get("content") or {}).get("ai_suggestion") or {}
        s, e = a.get("date_start", ""), a.get("date_end", "")
        if not (ISO.match(s or "") and ISO.match(e or "")):
            skipped["날짜없음/형식오류"] += 1; continue
        if s > date_to or e < date_from:
            skipped["기간밖"] += 1; continue
        cands.append(r)

    # 이미 공개된 행사와 같은 것(제목+시작일)은 다시 공개하지 않는다 (정기 실행 때 다른 출처에서 같은 행사가 들어와도)
    published = {(norm(e["title"]), e["event_date_start"]) for e in
                 db.supabase.table("events").select("title,event_date_start").execute().data}

    groups = {}
    for r in cands:
        a = r["content"]["ai_suggestion"]
        groups.setdefault((norm(r["content"]["title"]), a["date_start"]), []).append(r)

    report = {"published": [], "duplicates": [], "link_failed": [], "skipped": skipped}
    async with aiohttp.ClientSession() as session:
        for key, grp in groups.items():
            if key in published:
                for r in grp:
                    report["duplicates"].append({"title": r["content"]["title"], "source": r["source"], "kept": "이미 공개됨"})
                    if not dry:
                        db.supabase.table("raw_posts").update({"status": "DUPLICATE"}).eq("id", r["id"]).execute()
                continue
            grp.sort(key=rank)
            chosen = None
            for r in grp:
                ok, status, _ = await check_link(session, r["source_url"])
                if ok:
                    chosen = r; break
                report["link_failed"].append({"title": r["content"]["title"], "url": r["source_url"], "status": status})
            if not chosen:
                continue
            for r in grp:
                if r is not chosen:
                    report["duplicates"].append({"title": r["content"]["title"], "source": r["source"], "kept": chosen["source"]})
                    if not dry:
                        db.supabase.table("raw_posts").update({"status": "DUPLICATE"}).eq("id", r["id"]).execute()
            a = chosen["content"]["ai_suggestion"]
            price = a.get("price", "")
            desc_parts = [chosen["content"].get("description", "").strip()]
            for label, k in (("일시", "time"), ("관람료", "price"), ("관람연령", "age"), ("러닝타임", "runtime"), ("출연", "cast"), ("장르", "genre")):
                if a.get(k):
                    desc_parts.append(f"{label}: {a[k]}")
            event = {
                "title": chosen["content"]["title"],
                "description": "\n".join(p for p in desc_parts if p)[:4000],
                "category": a.get("category") or "행사",
                "region": a.get("region") or "경남",
                "venue": a.get("venue") or "",
                "event_date_start": a["date_start"],
                "event_date_end": a["date_end"],
                "price_info": price,
                "is_free": "무료" in price,
                "poster_image_url": (chosen.get("image_urls") or [None])[0] or a.get("poster_url"),
                "source": chosen["source"],
                "original_url": chosen["source_url"],
                "status": "PUBLISHED",
                "published_at": datetime.now(timezone.utc).isoformat(),
                "raw_post_id": chosen["id"],
            }
            if not dry:
                res = db.supabase.table("events").insert(event).execute()
                if not res.data:
                    report["link_failed"].append({"title": event["title"], "url": "", "status": "insert failed"}); continue
                db.supabase.table("raw_posts").update({"status": "PUBLISHED"}).eq("id", chosen["id"]).execute()
            report["published"].append({"title": event["title"], "category": event["category"], "region": event["region"],
                                        "start": event["event_date_start"], "end": event["event_date_end"],
                                        "source": event["source"], "url": event["original_url"]})
            await asyncio.sleep(0.1)

    out = os.path.join("..", "docs", f"publish_{date_from}_{date_to}{'_dryrun' if dry else ''}.json")
    json.dump(report, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    summary = (f"후보 {len(cands)}건 → 발행 {len(report['published'])}, 중복 {len(report['duplicates'])}, "
               f"링크실패 {len(report['link_failed'])}, 제외 {skipped}")
    print(summary)
    print(f"결과: {os.path.abspath(out)}")
    return summary


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    asyncio.run(main(args[0], args[1], "--dry-run" in sys.argv))
