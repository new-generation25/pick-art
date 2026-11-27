"""대기함의 인스타 후보(raw_posts REVIEW) 가운데 같은 계정이 같은 행사를 여러 번 올린 글을 하나만 남긴다.

같은 글로 보는 기준: 계정이 같고, 정리한 제목(naver_blog_scraper._norm)이 같고, 시작일이 같다. 날짜가 없는 글은 보지 않는다.
묶음마다 하나(대표 글)를 남기고 나머지는 status 를 REJECTED 로 바꾼다(지우지 않는다. 관리자 «반영 안 한 것»에서 되돌릴 수 있다).
대표 글 고르기(위에서부터): 승인한 글 → 운영자 코멘트가 있는 글 → 공개 후보 > 동의 필요 > 사람 판단 → 장소가 있는 글
→ 끝나는 날이 시작일과 다른 글(기간을 읽은 글) → 캡션이 긴 글 → 먼저 수집한 글.
바꾼 줄은 logs/dedupe_review/applied_<날짜시각>.json 에 남긴다.

사용 (collector 폴더에서)
  python tools/dedupe_review.py --dry-run     바꾸지 않고 묶음을 logs/dedupe_review/dry_<날짜시각>.json 에
  python tools/dedupe_review.py --apply       적용
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from naver_blog_scraper import _norm  # noqa: E402

KST = timezone(timedelta(hours=9))
LOG_DIR = os.path.join(HERE, "logs", "dedupe_review")
PAGE = 1000
BUCKET_RANK = {"candidate": 0, "consent": 1, "human": 2}


def event_key(row):
    """(계정, 정리한 제목, 시작일). 날짜나 제목이 없으면 None"""
    c = row.get("content") or {}
    a = c.get("ai_suggestion") or {}
    account = (a.get("account") or "").strip().lower()
    title, start = _norm(c.get("title") or ""), a.get("date_start") or ""
    return (account, title, start) if account and title and start else None


def keep_order(row):
    c = row.get("content") or {}
    a = c.get("ai_suggestion") or {}
    return (
        0 if c.get("publish_approved_at") else 1,
        0 if c.get("admin_notes") else 1,
        BUCKET_RANK.get(c.get("review_bucket"), 3),
        0 if (a.get("venue") or "").strip() else 1,
        0 if (a.get("date_end") or "") > (a.get("date_start") or "") else 1,
        -len(c.get("description") or ""),
        row.get("collected_at") or "",
    )


def plan(rows):
    """→ [{keep: row, drop: [row, ...]}] (겹치는 묶음만)"""
    groups = {}
    for r in rows:
        k = event_key(r)
        if k:
            groups.setdefault(k, []).append(r)
    out = []
    for k, lst in groups.items():
        if len(lst) < 2:
            continue
        lst = sorted(lst, key=keep_order)
        out.append({"key": k, "keep": lst[0], "drop": lst[1:]})
    return out


def read_rows(sb):
    rows, start = [], 0
    while True:
        page = (sb.table("raw_posts").select("id,source_url,collected_at,status,content")
                .eq("status", "REVIEW").eq("source", "인스타그램").order("id").range(start, start + PAGE - 1).execute().data or [])
        rows += page
        if len(page) < PAGE:
            return rows
        start += PAGE


def main(argv):
    from database import Database
    sb = Database().supabase
    stamp = datetime.now(KST).strftime("%Y%m%d_%H%M%S")
    os.makedirs(LOG_DIR, exist_ok=True)
    plans = plan(read_rows(sb))
    n_drop = sum(len(p["drop"]) for p in plans)
    brief = [{"account": p["key"][0], "title": (p["keep"]["content"] or {}).get("title"), "start": p["key"][2],
              "keep": {"id": p["keep"]["id"], "url": p["keep"]["source_url"]},
              "drop": [{"id": r["id"], "url": r["source_url"], "bucket": (r["content"] or {}).get("review_bucket")} for r in p["drop"]]}
             for p in plans]
    if "--apply" not in argv:
        path = os.path.join(LOG_DIR, f"dry_{stamp}.json")
        json.dump(brief, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"(바꾸지 않음) {path}")
        print(f"겹치는 글: {len(plans)}묶음 · 옮길 글 {n_drop}건")
        return 0
    done = 0
    for p in plans:
        keep = p["keep"]
        for r in p["drop"]:
            c = json.loads(json.dumps(r["content"] or {}))
            c.pop("publish_approved_at", None)
            c.pop("publish_failed_at", None)
            c["rejected_reason"] = f"같은 계정이 같은 행사를 올린 다른 글 — 대표 글 {keep['source_url']} 을 남김"
            c["rejected_by"] = "세션: 겹치는 글 정리"
            c["duplicate_of"] = keep["id"]
            got = sb.table("raw_posts").update({"status": "REJECTED", "content": c}).eq("id", r["id"]).eq("status", "REVIEW").execute().data or []
            done += len(got)
    path = os.path.join(LOG_DIR, f"applied_{stamp}.json")
    json.dump(brief, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✅ 겹치는 글 정리: {len(plans)}묶음 · 옮김 {done}/{n_drop}건 · 기록 {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
