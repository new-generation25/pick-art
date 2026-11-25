"""피카 인스타에 소개한 행사를 events.insta_post_url · insta_posted_at 에 반영한다.

원본: docs/insta/posted.json (인스타 운영 세션이 쓰는 기록. 여기서는 읽기만 한다)
  한 줄 = {event_id, post_url, posted_at, ...}. 한 행사를 여러 번 소개했으면 posted_at 이 가장 늦은 게시물을 쓴다.
반영 규칙
  - event_id 가 공개(PUBLISHED) 행이면 두 칸을 채운다(값이 같으면 건너뜀)
  - 숨긴(HIDDEN 등) 행이나 없는 행을 가리키면 반영하지 않고 건수와 id 앞 8자를 보고한다
  - posted.json 에서 빠진 행사의 칸은 지우지 않는다(게시물은 인스타에 남아 있다)
쓰기: collector/.env.local 의 service 키

사용: python tools/sync_insta_posts.py [--dry-run]   (collector 폴더에서. 마지막 줄이 한 줄 요약)
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402

POSTED = os.path.normpath(os.path.join(HERE, "..", "docs", "insta", "posted.json"))
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
DATE = re.compile(r"^20\d\d-\d\d-\d\d")


def latest_posts(rows):
    """event_id → (post_url, posted_at). posted_at 이 가장 늦은 줄."""
    best = {}
    for r in rows:
        eid, url, at = r.get("event_id"), r.get("post_url"), (r.get("posted_at") or "")[:10]
        if not (eid and UUID.match(eid) and url and url.startswith("https://www.instagram.com/") and DATE.match(at)):
            continue
        if eid not in best or at > best[eid][1]:
            best[eid] = (url, at)
    return best


def main():
    dry = "--dry-run" in sys.argv
    if not os.path.exists(POSTED):
        print(f"⏭️ 인스타 게시 반영 건너뜀: {POSTED} 없음")
        return 0
    with open(POSTED, encoding="utf-8") as f:
        best = latest_posts(json.load(f))

    db = Database().supabase
    ids = list(best)
    rows = {}
    for i in range(0, len(ids), 100):
        for e in db.table("events").select("id,status,insta_post_url,insta_posted_at").in_("id", ids[i:i + 100]).execute().data or []:
            rows[e["id"]] = e

    updated = same = 0
    hidden, missing = [], []
    for eid, (url, at) in best.items():
        e = rows.get(eid)
        if not e:
            missing.append(eid[:8])
            continue
        if e["status"] != "PUBLISHED":
            hidden.append(eid[:8])
            continue
        if e.get("insta_post_url") == url and (e.get("insta_posted_at") or "")[:10] == at:
            same += 1
            continue
        if not dry:
            db.table("events").update({"insta_post_url": url, "insta_posted_at": at}).eq("id", eid).execute()
        updated += 1

    # 반영됐는지 다시 읽어 센다 (공개 행 중 칸이 채워진 수)
    filled = 0
    if not dry:
        for i in range(0, len(ids), 100):
            filled += len([e for e in db.table("events").select("id").in_("id", ids[i:i + 100])
                           .eq("status", "PUBLISHED").not_.is_("insta_post_url", "null").execute().data or []])

    mark = "⚠️" if hidden or missing else "✅"
    tail = ""
    if hidden:
        tail += f" · 숨긴 행을 가리킴 {len(hidden)}({', '.join(hidden[:5])})"
    if missing:
        tail += f" · 없는 행 {len(missing)}({', '.join(missing[:5])})"
    head = "(시험) " if dry else ""
    print(f"{mark} {head}인스타 게시 반영: 소개한 행사 {len(best)} · 새로 반영 {updated} · 그대로 {same}"
          + ("" if dry else f" · 공개 행 중 채워짐 {filled}") + tail)
    return 0


if __name__ == "__main__":
    sys.exit(main())
