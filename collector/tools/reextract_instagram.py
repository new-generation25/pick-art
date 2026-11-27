"""대기함의 인스타 후보(raw_posts REVIEW)를 지금 추출 규칙으로 다시 읽어 제목·장소·날짜를 고친다.

추출 규칙(insta_browser_scraper.extract_post_event)을 고친 뒤, 이미 쌓인 후보에도 같은 규칙을 적용할 때 쓴다.
저장해 둔 캡션(content.description, 앞 1,500자)만 다시 읽는다. 인스타그램에 접속하지 않는다.
  - 제목: 새 규칙의 제목이 지금과 다르면 바꾼다(한 글에 행사가 3건 이상인 묶음 글은 건드리지 않는다)
  - 장소: 지금 비어 있고 새 규칙이 장소를 찾았으면 채운다(이미 있는 장소는 두지 않고 그대로 둔다)
  - 날짜: 시작이 같고 끝만 늘어나는 경우만 바꾼다(«12.03(목)-05(토)»처럼 끝을 일만 적은 기간). 운영자가 적은 날짜(date_by=admin)는 건드리지 않는다
  - 기관 계정인데 장소가 없어 «사람 판단»(no_venue)에 간 글이 장소를 얻으면 규칙대로 «공개 후보»(official_complete)로 옮긴다
지우지 않는다. 바꾸기 전 값을 logs/reextract/applied_<날짜시각>.json 에 남긴다.

사용 (collector 폴더에서)
  python tools/reextract_instagram.py --dry-run     바꾸지 않고 바뀔 내용을 logs/reextract/dry_<날짜시각>.json 에
  python tools/reextract_instagram.py --apply       적용
  python tools/reextract_instagram.py --undo <파일>  그 적용에서 바꾼 줄을 이전 값으로(그사이 다시 바뀐 줄은 건너뜀)
"""
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from insta_browser_scraper import caption_lines, extract_post_event  # noqa: E402

KST = timezone(timedelta(hours=9))
ISO = re.compile(r"^20\d\d-\d\d-\d\d$")
LOG_DIR = os.path.join(HERE, "logs", "reextract")
PAGE = 1000
VENUE_PLACEHOLDERS = {"공연장소", "장소", "행사장소", "전시장소", "미정", "장소미정", "추후공지", "추후안내"}  # triage_review 와 같다


def ref_date(row):
    a = (row.get("content") or {}).get("ai_suggestion") or {}
    for v in (a.get("posted_at"), (row.get("collected_at") or "")[:10]):
        if v and ISO.match(v):
            return date.fromisoformat(v)
    return date.today()


def plan_row(row):
    """한 줄 → 바꿀 것 dict(없으면 None). {id, before:{...}, after:{...}, move}"""
    c = row.get("content") or {}
    a = c.get("ai_suggestion") or {}
    if a.get("extracted_by") != "insta_browser":
        return None
    cap = re.sub(r"\n?댓글( \d+개)? 모두 보기.*$", "", c.get("description") or "", flags=re.S)
    evs = extract_post_event(caption_lines(cap), ref_date(row), row.get("source_url") or "")
    m = re.search(r"_(\d+)$", row.get("source_id") or "")
    idx = int(m.group(1)) if m else 0
    if len(evs) >= 3:
        ev = evs[idx] if idx < len(evs) else None
    else:
        ev = evs[0] if evs and idx == 0 else None
    if not ev:
        return None
    before = {"title": c.get("title") or "", "venue": a.get("venue") or "", "date_start": a.get("date_start") or "", "date_end": a.get("date_end") or ""}
    after = dict(before)
    single = len(evs) < 3
    if single and ev["title"] and ev["title"] != before["title"]:
        after["title"] = ev["title"]
    if ev["venue"] and not before["venue"]:
        after["venue"] = ev["venue"]
    # 날짜는 «시작이 같고 끝만 늘어나는 경우»만 바꾼다(12.03(목)-05(토) 처럼 끝을 일만 적어 놓쳤던 기간).
    # 그 밖의 차이는 사람이나 다른 도구가 고친 값일 수 있어 두지 않고 그대로 둔다
    if (a.get("date_by") != "admin" and ev["start"] and ev["start"] == before["date_start"]
            and before["date_end"] in ("", before["date_start"]) and ev["end"] > ev["start"]):
        after["date_end"] = ev["end"]
    if after == before:
        return None
    venue_ok = bool(after["venue"]) and after["venue"].replace(" ", "") not in VENUE_PLACEHOLDERS
    move = (c.get("review_bucket") == "human" and c.get("review_reason") == "no_venue"
            and (a.get("role") or "").lower() == "official" and venue_ok and bool(after["date_start"]))
    return {"id": row["id"], "source_url": row.get("source_url"), "account": a.get("account") or "",
            "before": before, "after": after, "move_to_candidate": move}


def apply_plan(content, p, now_iso):
    c = json.loads(json.dumps(content or {}))
    a = c.setdefault("ai_suggestion", {})
    c["title"] = p["after"]["title"]
    a["venue"], a["date_start"], a["date_end"] = p["after"]["venue"], p["after"]["date_start"], p["after"]["date_end"]
    a["date_parsed"] = bool(a["date_start"])
    c["reextracted_at"] = now_iso
    if p["move_to_candidate"]:
        c["review_bucket"], c["review_reason"], c["review_bucket_at"] = "candidate", "official_complete", now_iso
    return c


def read_rows(sb):
    rows, start = [], 0
    while True:
        page = (sb.table("raw_posts").select("id,source_id,source_url,collected_at,status,content")
                .eq("status", "REVIEW").eq("source", "인스타그램").order("id").range(start, start + PAGE - 1).execute().data or [])
        rows += page
        if len(page) < PAGE:
            return rows
        start += PAGE


def summary(plans):
    n = lambda k: sum(1 for p in plans if p["before"][k] != p["after"][k])
    return (f"다시 읽기: 바뀌는 글 {len(plans)}건 · 제목 {n('title')} · 장소 {n('venue')} · "
            f"날짜 {sum(1 for p in plans if (p['before']['date_start'], p['before']['date_end']) != (p['after']['date_start'], p['after']['date_end']))} · "
            f"공개 후보로 옮김 {sum(1 for p in plans if p['move_to_candidate'])}")


def main(argv):
    from database import Database
    sb = Database().supabase
    stamp = datetime.now(KST).strftime("%Y%m%d_%H%M%S")
    os.makedirs(LOG_DIR, exist_ok=True)
    if "--undo" in argv:
        items = json.load(open(argv[argv.index("--undo") + 1], encoding="utf-8"))
        done = 0
        for it in items:
            cur = sb.table("raw_posts").select("status,content").eq("id", it["id"]).maybe_single().execute()
            row = cur.data if cur else None
            if not row or row["status"] != "REVIEW" or (row["content"] or {}).get("reextracted_at") != it["applied_at"]:
                continue   # 그사이 다시 바뀐 줄은 건드리지 않는다
            sb.table("raw_posts").update({"content": it["content_before"]}).eq("id", it["id"]).eq("status", "REVIEW").execute()
            done += 1
        print(f"되돌림 {done}/{len(items)}건")
        return 0
    rows = read_rows(sb)
    plans = [p for p in (plan_row(r) for r in rows) if p]
    if "--apply" not in argv:
        path = os.path.join(LOG_DIR, f"dry_{stamp}.json")
        json.dump(plans, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"(바꾸지 않음) {path}")
        print(summary(plans))
        return 0
    by_id = {r["id"]: r for r in rows}
    now_iso = datetime.now(timezone.utc).isoformat()
    log = []
    for p in plans:
        row = by_id[p["id"]]
        new = apply_plan(row["content"], p, now_iso)
        got = sb.table("raw_posts").update({"content": new}).eq("id", p["id"]).eq("status", "REVIEW").execute().data or []
        if got:
            log.append({**p, "applied_at": now_iso, "content_before": row["content"]})
    path = os.path.join(LOG_DIR, f"applied_{stamp}.json")
    json.dump(log, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"적용 {len(log)}/{len(plans)}건 · 기록 {path}")
    print("✅ " + summary(plans))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
