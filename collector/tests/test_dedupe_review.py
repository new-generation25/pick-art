import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import dedupe_review  # noqa: E402


def row(i, title, start, account="acc", bucket="consent", venue="", notes=None, approved=None, desc="", end=None, at="2026-11-20"):
    c = {"title": title, "description": desc, "review_bucket": bucket,
         "ai_suggestion": {"account": account, "date_start": start, "date_end": end or start, "venue": venue}}
    if notes:
        c["admin_notes"] = notes
    if approved:
        c["publish_approved_at"] = approved
    return {"id": i, "source_url": f"https://www.instagram.com/p/{i}/", "collected_at": at, "status": "REVIEW", "content": c}


def test_groups_same_account_title_start_only():
    rows = [row("a", "2026 부산국제아트페어 BIAF", "2026-12-03"), row("b", "2026 부산국제아트페어  BIAF", "2026-12-03"),
            row("c", "2026 부산국제아트페어 BIAF", "2026-12-03", account="other"),
            row("d", "2026 부산국제아트페어 BIAF", "2026-12-04"), row("e", "날짜 없는 글", "")]
    plans = dedupe_review.plan(rows)
    assert len(plans) == 1 and {plans[0]["keep"]["id"]} | {r["id"] for r in plans[0]["drop"]} == {"a", "b"}


def test_keep_prefers_approved_then_notes_then_bucket_then_venue():
    base = lambda i, **k: row(i, "나는 나를 죽였다", "2026-12-03", **k)
    assert dedupe_review.plan([base("a", venue="나다소극장"), base("b", approved="2026-11-27T00:00:00Z")])[0]["keep"]["id"] == "b"
    assert dedupe_review.plan([base("a", venue="나다소극장"), base("b", notes=[{"text": "x"}])])[0]["keep"]["id"] == "b"
    assert dedupe_review.plan([base("a", venue="나다소극장"), base("b", bucket="candidate")])[0]["keep"]["id"] == "b"
    assert dedupe_review.plan([base("a"), base("b", venue="나다소극장")])[0]["keep"]["id"] == "b"
    assert dedupe_review.plan([base("a", desc="짧다"), base("b", desc="더 긴 캡션이다")])[0]["keep"]["id"] == "b"
