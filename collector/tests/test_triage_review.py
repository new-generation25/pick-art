"""tools/triage_review.py 판정·적용·되돌리기 검사(가짜 DB). 실행: python -m pytest collector/tests -q"""
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import triage_review as tr  # noqa: E402

TODAY = "2026-11-26"


class FakeStore:
    """triage_review.Store 와 같은 메서드. 줄은 메모리에만 있다."""

    def __init__(self, rows, events):
        self.rows = {r["id"]: json.loads(json.dumps(r)) for r in rows}
        self.ev = events
        self.writes = 0

    def review_rows(self):
        return [json.loads(json.dumps(r)) for r in self.rows.values() if r["status"] == "REVIEW"]

    def events(self):
        return list(self.ev)

    def get(self, rid):
        r = self.rows.get(rid)
        return json.loads(json.dumps(r)) if r else None

    def update(self, rid, expect_status, status, content):
        r = self.rows.get(rid)
        if not r or r["status"] != expect_status:
            return False
        r["status"], r["content"] = status, content
        self.writes += 1
        return True


def row(rid, title, start="", end="", role="official", venue="문화회관", image_only=False, **extra):
    c = {"title": title, "ai_suggestion": {"date_start": start, "date_end": end, "role": role, "venue": venue,
                                           "region": "김해", "image_only": image_only}}
    c.update(extra)
    return {"id": rid, "status": "REVIEW", "content": c}


ROWS = [
    row("ended", "지난 공연", "2026-11-01", "2026-11-20"),
    row("ended_start_only", "시작만 지난", "2026-11-01", ""),
    row("today_end", "오늘 끝나는 전시", "2026-11-01", "2026-11-26", role="artist"),
    row("dup", "〈더 드레서〉", "2026-12-05", "2026-12-06"),
    row("dup_contains", "김해 겨울 음악회 앙코르", "2026-12-10", "2026-12-10", role="informant"),
    row("artist", "작가 개인전", "2026-12-01", "2026-12-20", role="artist"),
    row("group", "극단 정기공연", "2026-12-01", "2026-12-02", role="group", venue=""),
    row("official_ok", "기관 공연", "2026-12-01", "2026-12-02"),
    row("official_novenue", "기관 행사", "2026-12-01", "2026-12-02", venue=""),
    row("official_placeholder", "기관 축제", "2026-12-01", "2026-12-02", venue="공연장소"),
    row("official_nodate", "기관 날짜 없음", venue="문화회관"),
    row("informant", "제보 공연", "2026-12-01", "2026-12-02", role="informant"),
    row("image_only", "포스터만", "2026-12-01", "2026-12-02", role="official", venue="", image_only=True),
    row("kept", "사람이 고친 무더기", "2026-12-01", "2026-12-02", role="artist",
        review_bucket="human", review_reason="manual"),
    row("kept_but_ended", "무더기 있는데 끝남", "2026-11-01", "2026-11-02", review_bucket="candidate"),
    row("empty_title", "", "2026-12-05", "2026-12-06"),
]
EVENTS = [
    {"id": 1, "title": "연극 <더 드레서> [진주]", "event_date_start": "2026-12-05"},
    {"id": 2, "title": "김해 겨울 음악회", "event_date_start": "2026-12-10"},
    {"id": 3, "title": "다른 날 기관 공연", "event_date_start": "2026-12-02"},
]
EXPECT = {
    "ended": ("ended", "EXPIRED"), "ended_start_only": ("ended", "EXPIRED"),
    "today_end": ("small_needs_consent", "consent"),
    "dup": ("published_same", "DUPLICATE"), "dup_contains": ("published_same", "DUPLICATE"),
    "artist": ("small_needs_consent", "consent"), "group": ("small_needs_consent", "consent"),
    "official_ok": ("official_complete", "candidate"),
    "official_novenue": ("no_venue", "human"), "official_placeholder": ("no_venue", "human"),
    "official_nodate": ("no_date", "human"), "informant": ("informant", "human"),
    "image_only": ("image_only", "human"), "kept": ("kept", None),
    "kept_but_ended": ("ended", "EXPIRED"), "empty_title": ("official_complete", "candidate"),
}


def test_rules():
    got = {d["id"]: (d["rule"], d["result"]) for d in tr.plan(FakeStore(ROWS, EVENTS).review_rows(), EVENTS, TODAY)}
    assert got == EXPECT


def test_dry_run_writes_nothing(tmp_path):
    s = FakeStore(ROWS, EVENTS)
    decisions, path = tr.dry_run(s, TODAY, log_dir=str(tmp_path))
    assert s.writes == 0
    assert all(r["status"] == "REVIEW" for r in s.rows.values())
    items = json.load(open(path, encoding="utf-8"))
    assert os.path.basename(path) == f"triage_{TODAY}.json"
    assert {i["id"] for i in items} == {r["id"] for r in ROWS}
    assert all(set(i) >= {"id", "title", "rule", "result"} for i in items)
    line = tr.summary(decisions)
    assert line == "✅ REVIEW 정리: 만료 3 · 중복 2 · 동의 필요 3 · 공개 후보 2 · 사람 판단 6 (남은 REVIEW 11)"


def test_apply_then_undo(tmp_path):
    s = FakeStore(ROWS, EVENTS)
    before = json.loads(json.dumps(s.rows))
    decisions, path, failed = tr.apply(s, TODAY, now=datetime(2026, 11, 26, 9, 0, 0), log_dir=str(tmp_path))
    assert failed == 0
    assert os.path.basename(path) == "applied_2026-11-26_090000.json"
    assert s.rows["ended"]["status"] == "EXPIRED"
    assert s.rows["ended"]["content"]["review_reason"] == "ended"
    assert "review_bucket" not in s.rows["ended"]["content"]
    assert s.rows["dup"]["status"] == "DUPLICATE"
    assert s.rows["official_ok"]["content"]["review_bucket"] == "candidate"
    assert s.rows["official_ok"]["content"]["review_bucket_at"].startswith("2026-11-26T09:00")
    assert s.rows["informant"]["content"]["review_reason"] == "informant"
    # 사람이 정한 무더기는 덮어쓰지 않는다
    assert s.rows["kept"] == before["kept"]
    # 다른 칸(ai_suggestion 등)은 그대로
    assert s.rows["official_ok"]["content"]["ai_suggestion"] == before["official_ok"]["content"]["ai_suggestion"]
    # 적용 후 무더기 없는 REVIEW 0건
    assert not [r for r in s.rows.values() if r["status"] == "REVIEW" and not r["content"].get("review_bucket")]

    items = json.load(open(path, encoding="utf-8"))
    assert len(items) == len(ROWS) - 1  # kept 하나만 안 바뀜
    assert all(set(i) >= {"id", "prev_status", "prev_bucket", "new_status", "new_bucket"} for i in items)
    k = next(i for i in items if i["id"] == "kept_but_ended")
    assert (k["prev_status"], k["prev_bucket"], k["new_status"], k["new_bucket"]) == ("REVIEW", "candidate", "EXPIRED", "candidate")

    # 그사이 사람이 바꾼 줄 두 개: 상태를 바꾼 것, 무더기를 바꾼 것
    s.rows["artist"]["content"]["review_bucket"] = "human"
    s.rows["dup"]["status"] = "REVIEW"

    back, skipped, gone = tr.undo(s, path)
    assert (back, skipped, gone) == (len(items) - 2, 2, 0)
    for rid, r in s.rows.items():
        if rid in ("artist", "dup"):
            continue
        assert r == before[rid], rid
    assert s.rows["artist"]["content"]["review_bucket"] == "human"


def test_apply_twice_is_stable(tmp_path):
    s = FakeStore(ROWS, EVENTS)
    tr.apply(s, TODAY, now=datetime(2026, 11, 26, 9, 0, 0), log_dir=str(tmp_path))
    snap = json.loads(json.dumps(s.rows))
    decisions, path, failed = tr.apply(s, TODAY, now=datetime(2026, 11, 27, 9, 0, 0), log_dir=str(tmp_path))
    assert path == "" and failed == 0
    assert s.rows == snap
    assert tr.summary(decisions).endswith("(남은 REVIEW 11)")


def test_apply_skips_row_changed_meanwhile(tmp_path):
    s = FakeStore(ROWS, EVENTS)
    real_update = s.update

    def racing(rid, expect, status, content):
        if rid == "artist":  # 읽은 뒤 쓰기 전에 다른 세션이 공개함
            s.rows[rid]["status"] = "PUBLISHED"
        return real_update(rid, expect, status, content)
    s.update = racing
    decisions, path, failed = tr.apply(s, TODAY, now=datetime(2026, 11, 26, 9, 0, 0), log_dir=str(tmp_path))
    assert failed == 1
    assert s.rows["artist"]["status"] == "PUBLISHED"
    assert "artist" not in {i["id"] for i in json.load(open(path, encoding="utf-8"))}
