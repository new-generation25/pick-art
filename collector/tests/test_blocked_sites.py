"""blocked_sites.py — 막히는 누리집 3회 연속이면 위험 사이트(운영자 2026-11-27). 실행: python -m pytest collector/tests -q"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import blocked_sites as bs  # noqa: E402


class Q:
    def __init__(self, db): self.db, self.payload, self.id = db, None, None
    def select(self, *_a): return self
    def ilike(self, _c, pat): self.pat = pat.strip("%"); return self
    def update(self, p): self.payload = p; return self
    def eq(self, _c, v): self.id = v; return self
    @property
    def not_(self): return self
    def is_(self, *_a): return self

    def execute(self):
        rows = self.db.rows
        if self.payload is not None:
            for r in rows:
                if r["id"] == self.id:
                    r.update(self.payload)
            return type("R", (), {"data": []})()
        if getattr(self, "pat", None):
            rows = [r for r in rows if self.pat in r["value"]]
        return type("R", (), {"data": [dict(r) for r in rows]})()


class DB:
    def __init__(self, rows): self.rows, self.supabase = rows, self
    def table(self, _n): return Q(self)


@pytest.fixture(autouse=True)
def tmp_state(tmp_path, monkeypatch):
    monkeypatch.setattr(bs, "STATE", str(tmp_path / "blocked.json"))


def test_check_response():
    with pytest.raises(bs.SiteBlocked):
        bs.check_response(403, "")
    with pytest.raises(bs.SiteBlocked):
        bs.check_response(200, "<html>비정상적인 접근으로 차단되었습니다</html>")
    bs.check_response(200, "<html>공연 목록</html>")  # 정상
    bs.check_response(200, "x" * 30000 + "Access Denied")  # 긴 정상 페이지 속 낱말은 보지 않는다


def test_three_blocks_mark_risky_and_success_resets():
    db = DB([{"id": 1, "name": "통영시민문화회관", "value": "https://www.tongyeong.go.kr/citizen/a.web", "type": "webpage", "paused_reason": None},
             {"id": 2, "name": "인스타", "value": "https://www.instagram.com/tongyeong.go.kr/", "type": "instagram", "paused_reason": None},
             {"id": 3, "name": "이미 쉼", "value": "https://tongyeong.go.kr/b.web", "type": "webpage", "paused_reason": "운영자 메모"}])
    url = "https://www.tongyeong.go.kr/citizen/a.web"
    assert "1/3" in bs.record(db, url, True, "HTTP 403")
    assert bs.record(db, url, False) == ""  # 성공하면 처음부터
    assert "1/3" in bs.record(db, url, True, "HTTP 403")
    assert "2/3" in bs.record(db, url, True, "HTTP 403")
    note = bs.record(db, url, True, "HTTP 403")
    assert "위험 사이트" in note and "통영시민문화회관" in note
    assert db.rows[0]["paused_reason"].startswith("위험 사이트(") and "3회 연속" in db.rows[0]["paused_reason"]
    assert db.rows[1]["paused_reason"] is None  # 인스타 계정은 건드리지 않는다
    assert db.rows[2]["paused_reason"] == "운영자 메모"  # 이미 쉬는 출처의 이유는 덮지 않는다
    assert len(db.rows[0]["paused_reason"]) <= 300


def test_paused_hosts():
    db = DB([{"value": "https://www.bscf.or.kr/view.do", "type": "webpage", "paused_reason": "위험 사이트"},
             {"value": "https://www.instagram.com/x/", "type": "instagram", "paused_reason": "쉼"},
             {"value": "https://ok.example/", "type": "webpage", "paused_reason": "  "}])
    assert bs.paused_hosts(db) == {"bscf.or.kr"}
