import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import review_notes  # noqa: E402


def row(i, notes, **content):
    return {"id": i, "status": "REVIEW", "source": "인스타그램", "source_url": f"https://www.instagram.com/p/{i}/",
            "content": {"title": f"글 {i}", "ai_suggestion": {"account": "acc", "role": "official"}, "admin_notes": notes, **content}}


def test_collect_keeps_only_rows_with_notes_and_sorts_by_latest():
    rows = [
        row("a", [{"at": "2026-11-27T01:00:00Z", "text": "날짜가 포스터에만 있음", "bucket": "human", "reason": "no_date"}]),
        row("b", []),
        row("c", [{"at": "2026-11-27T03:00:00Z", "text": " 후기 글 ", "bucket": "candidate", "reason": "official_complete"},
                  {"at": "2026-11-27T02:00:00Z", "text": "  "}, "깨진 값"]),
        {"id": "d", "status": "COLLECTED", "source": "기관", "source_url": "https://x", "content": None},
    ]
    out = review_notes.collect(rows)
    assert [x["id"] for x in out] == ["c", "a"]
    assert out[0]["notes"] == [{"at": "2026-11-27T03:00:00Z", "text": "후기 글", "bucket": "candidate", "reason": "official_complete"}]
    assert out[1]["account"] == "acc" and out[1]["notes"][0]["reason"] == "no_date"
