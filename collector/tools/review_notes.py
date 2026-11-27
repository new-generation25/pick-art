"""운영자가 대기함 글에 남긴 코멘트 모아 보기 (specs/019 A7).

관리자 › 대기함의 «자세히 · 코멘트» 창에서 쓴 글은 raw_posts.content.admin_notes 에 쌓인다
(줄마다 {at, by, text, bucket, reason} — bucket·reason 은 코멘트를 쓴 때의 갈래와 분류 이유).
분류 규칙(tools/triage_review.py)이나 공개 검증(tools/publish_verified.py)을 손보기 전에 이 목록을 읽는다.
읽기만 한다. 아무것도 바꾸지 않는다.

사용 (collector 폴더에서)
  python tools/review_notes.py                 코멘트가 있는 글을 최근 코멘트 순으로 출력
  python tools/review_notes.py --json <파일>    같은 내용을 JSON 으로 저장
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.chdir(HERE)
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env.local")

PAGE = 1000


def collect(rows):
    """raw_posts 줄들 → 코멘트가 있는 글 목록(최근 코멘트가 위). 테스트에서 바로 부른다"""
    out = []
    for r in rows:
        c = r.get("content") or {}
        notes = [n for n in (c.get("admin_notes") or []) if isinstance(n, dict) and (n.get("text") or "").strip()]
        if not notes:
            continue
        a = c.get("ai_suggestion") or {}
        out.append({
            "id": r["id"], "status": r.get("status"), "source": r.get("source"), "source_url": r.get("source_url"),
            "title": c.get("title") or "", "account": a.get("account") or "", "role": a.get("role") or "",
            "bucket": c.get("review_bucket") or "", "reason": c.get("review_reason") or "",
            "notes": [{"at": n.get("at") or "", "text": n["text"].strip(), "bucket": n.get("bucket") or "", "reason": n.get("reason") or ""}
                      for n in notes],
        })
    out.sort(key=lambda x: max(n["at"] for n in x["notes"]), reverse=True)
    return out


def read_rows(sb):
    rows, start = [], 0
    while True:
        page = (sb.table("raw_posts").select("id,status,source,source_url,content")
                .not_.is_("content->admin_notes", "null").order("id").range(start, start + PAGE - 1).execute().data or [])
        rows += page
        if len(page) < PAGE:
            return rows
        start += PAGE


def main(argv):
    from database import Database
    items = collect(read_rows(Database().supabase))
    if "--json" in argv:
        path = argv[argv.index("--json") + 1]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=1)
    for it in items:
        who = f"@{it['account']}({it['role']})" if it["account"] else it["source"]
        print(f"■ {it['title'][:50]} | {who} | 지금: {it['status']} {it['bucket']} {it['reason']}")
        for n in it["notes"]:
            print(f"   - {n['at'][:16]} [{n['bucket']} {n['reason']}] {n['text']}")
    print(f"코멘트가 있는 글 {len(items)}건, 코멘트 {sum(len(i['notes']) for i in items)}개")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
