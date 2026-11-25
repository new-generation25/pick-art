"""앱 DB events 행을 지우지 않고 숨긴다(status 를 PUBLISHED 가 아닌 값으로). 되돌리기도 한다.

앱·anon 키는 status='PUBLISHED' 만 읽으므로 다른 값이면 앱에서 보이지 않는다.
쓰기는 collector/.env.local 의 키(Database)로 한다. 바꾸기 전 행을 백업 파일에 먼저 저장한다.

사용 (collector 폴더에서, PYTHONIOENCODING=utf-8):
  python tools/hide_events.py hide <id> [<id> ...] --backup <json> --why "<이유>" [--status HIDDEN] [--dry-run]
  python tools/hide_events.py restore --backup <json> [--dry-run]     백업에 적힌 옛 status 로 되돌린다
쓰는 곳: 같은 공연 중복 행(2026-11-26), 허락 철회 계정 출처 행사(INSTA_ENGAGE.md 「허락 철회」).
기본값 'HIDDEN' — 운영 DB 에서 허용됨을 2026-11-26 한 행으로 시험해 확인했다(schema.sql 의 옛 제약 목록에는 없다).
"""
import argparse
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")
from database import Database  # noqa: E402

COLS = "id,title,source,region,venue,event_date_start,event_date_end,status,original_url"


def hide(a):
    db = Database()
    rows = db.supabase.table("events").select(COLS).in_("id", a.ids).execute().data
    found = {r["id"] for r in rows}
    missing = [i for i in a.ids if i not in found]
    if missing:
        print(json.dumps({"ok": False, "error": "DB에 없는 id", "ids": missing}, ensure_ascii=False)); sys.exit(1)
    backup = {"at": datetime.now().astimezone().isoformat(timespec="seconds"), "why": a.why,
              "new_status": a.status, "rows": rows}
    if a.dry_run:
        print(json.dumps({"ok": True, "dry_run": True, "would_hide": [(r["id"], r["title"], r["status"]) for r in rows]},
                         ensure_ascii=False)); return
    os.makedirs(os.path.dirname(os.path.abspath(a.backup)), exist_ok=True)
    if os.path.exists(a.backup):
        print(json.dumps({"ok": False, "error": f"백업 파일이 이미 있다(덮어쓰지 않음): {a.backup}"}, ensure_ascii=False)); sys.exit(1)
    json.dump(backup, open(a.backup, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    done, errors = [], []
    for r in rows:
        try:
            db.supabase.table("events").update({"status": a.status}).eq("id", r["id"]).execute()
            done.append(r["id"])
        except Exception as e:  # 체크 제약 위반 등 — 그 자리에서 멈춘다
            errors.append({"id": r["id"], "error": str(e)[:300]}); break
    after = db.supabase.table("events").select("id,status").in_("id", a.ids).execute().data
    print(json.dumps({"ok": not errors, "hidden": len(done), "errors": errors,
                      "status_now": {x["id"]: x["status"] for x in after}, "backup": os.path.abspath(a.backup)},
                     ensure_ascii=False))
    if errors:
        sys.exit(1)


def restore(a):
    db = Database()
    b = json.load(open(a.backup, encoding="utf-8"))
    plan = [(r["id"], r["status"]) for r in b["rows"]]
    if a.dry_run:
        print(json.dumps({"ok": True, "dry_run": True, "would_restore": plan}, ensure_ascii=False)); return
    for i, s in plan:
        db.supabase.table("events").update({"status": s}).eq("id", i).execute()
    after = db.supabase.table("events").select("id,status").in_("id", [i for i, _ in plan]).execute().data
    print(json.dumps({"ok": True, "restored": len(plan), "status_now": {x["id"]: x["status"] for x in after}},
                     ensure_ascii=False))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    h = sub.add_parser("hide")
    h.add_argument("ids", nargs="+")
    h.add_argument("--backup", required=True)
    h.add_argument("--why", required=True)
    h.add_argument("--status", default="HIDDEN")
    h.add_argument("--dry-run", action="store_true")
    r = sub.add_parser("restore")
    r.add_argument("--backup", required=True)
    r.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    hide(a) if a.cmd == "hide" else restore(a)
