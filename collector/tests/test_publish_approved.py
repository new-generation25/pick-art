"""tools/publish_verified.py 의 승인 후보(REVIEW + publish_approved_at) 공개 검사(가짜 DB·가짜 링크 확인).
실행: python -m pytest collector/tests -q"""
import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import publish_verified as pv  # noqa: E402

TODAY = datetime.now(timezone(timedelta(hours=9))).date()
D1 = (TODAY + timedelta(days=10)).isoformat()
D2 = (TODAY + timedelta(days=12)).isoformat()
FAR = (TODAY + timedelta(days=200)).isoformat()
RANGE = (TODAY.isoformat(), (TODAY + timedelta(days=60)).isoformat())


class Res:
    def __init__(self, data, count=None):
        self.data, self.count = data, count


class Query:
    """supabase-py 질의 사슬 중 publish_verified 가 쓰는 것만"""

    def __init__(self, db, name):
        self.db, self.name, self.filters, self.op, self.payload, self.rng = db, name, [], "select", None, None

    def select(self, *_a, **_k):
        self.op = "select"; return self

    def update(self, payload):
        self.op, self.payload = "update", payload; return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload; return self

    def eq(self, col, val):
        self.filters.append(lambda r: r.get(col) == val); return self

    def in_(self, col, vals):
        vals = set(vals)
        self.filters.append(lambda r: r.get(col) in vals); return self

    def order(self, *_a, **_k):
        return self

    def range(self, a, b):
        self.rng = (a, b); return self

    def execute(self):
        rows = self.db.tables.setdefault(self.name, [])
        if self.op == "insert":
            row = dict(self.payload, id=f"ev{len(rows) + 1}")
            rows.append(row)
            return Res([dict(row)])
        hit = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "update":
            for r in hit:
                r.update(json.loads(json.dumps(self.payload)))
            return Res([dict(r) for r in hit])
        if self.rng:
            hit = hit[self.rng[0]:self.rng[1] + 1]
        elif len(hit) > 1000:  # PostgREST 기본 상한
            hit = hit[:1000]
        return Res(json.loads(json.dumps(hit)))


class FakeDB:
    def __init__(self, raw, events):
        self.tables = {"raw_posts": raw, "events": events}
        self.supabase = self

    def table(self, name):
        return Query(self, name)


def raw(rid, title, status="REVIEW", start=D1, end=D2, approved=True, url=None, **extra):
    c = {"title": title, "description": "캡션", "review_bucket": "candidate", "review_reason": "official_complete",
         "ai_suggestion": {"date_start": start, "date_end": end, "region": "김해", "venue": "문화회관",
                           "category": "공연", "poster_url": f"https://www.instagram.com/p/{rid}/media/?size=l"}}
    if approved:
        c["publish_approved_at"] = "2026-11-26T10:00:00+09:00"
    c.update(extra)
    return {"id": rid, "source": "인스타그램", "source_url": url or f"https://www.instagram.com/p/{rid}/",
            "status": status, "image_urls": [], "content": c}


def run(monkeypatch, tmp_path, rows, events=(), ids=None, bad_links=()):
    db = FakeDB(rows, list(events))
    uploads = []

    async def fake_link(_session, url):
        return (url not in bad_links), (404 if url in bad_links else 200), url

    async def fake_upload(_sb, url, key):
        uploads.append(url)
        return None, f"https://x.supabase.co/storage/{key}.webp", None

    monkeypatch.setattr(pv, "Database", lambda: db)
    monkeypatch.setattr(pv, "check_link", fake_link)
    monkeypatch.setattr(pv, "process_and_upload_image", fake_upload)
    monkeypatch.setattr(pv, "OUT_DIR", str(tmp_path))
    summary = asyncio.run(pv.main(RANGE[0], RANGE[1], False, ids=ids))
    return db, summary, uploads


def by_id(db, rid):
    return next(r for r in db.tables["raw_posts"] if r["id"] == rid)


def test_approved_candidate_is_published_with_uploaded_poster(monkeypatch, tmp_path):
    db, summary, uploads = run(monkeypatch, tmp_path, [raw("a", "기관 공연")], ids=["a"])
    ev = db.tables["events"]
    assert len(ev) == 1 and ev[0]["title"] == "기관 공연" and ev[0]["raw_post_id"] == "a"
    # 인스타 주소를 그대로 걸지 않고 저장소에 올린 포스터를 쓴다
    assert ev[0]["poster_image_url"].startswith("https://x.supabase.co/") and uploads
    r = by_id(db, "a")
    assert r["status"] == "PUBLISHED" and r["image_urls"] == [ev[0]["poster_image_url"]]
    assert "발행 1" in summary
    assert (tmp_path / f"publish_{RANGE[0]}_{RANGE[1]}_approved.json").exists()


def test_unapproved_review_is_skipped_even_with_ids(monkeypatch, tmp_path):
    db, summary, _ = run(monkeypatch, tmp_path, [raw("b", "승인 안 한 것", approved=False)], ids=["b"])
    assert db.tables["events"] == [] and by_id(db, "b")["status"] == "REVIEW"
    assert "publish_failed_at" not in by_id(db, "b")["content"]


def test_default_run_does_not_touch_review(monkeypatch, tmp_path):
    rows = [raw("c", "승인한 인스타"), raw("k", "기관 게시판 공연", status="COLLECTED", approved=False,
                                        url="https://org.example/1")]
    db, _, _ = run(monkeypatch, tmp_path, rows)  # ids 없음 = 예전 그대로(COLLECTED·PENDING 만)
    assert [e["raw_post_id"] for e in db.tables["events"]] == ["k"]
    assert by_id(db, "c")["status"] == "REVIEW"


def test_link_failure_keeps_review_and_writes_reason(monkeypatch, tmp_path):
    row = raw("d", "링크 죽은 공연")
    db, summary, _ = run(monkeypatch, tmp_path, [row], ids=["d"], bad_links={row["source_url"]})
    r = by_id(db, "d")
    assert r["status"] == "REVIEW" and db.tables["events"] == []
    c = r["content"]
    assert c["review_reason"].startswith("publish_failed: 원본 링크") and c["publish_failed_at"]
    # 다른 키(승인·무더기·추출값)는 그대로
    assert c["publish_approved_at"] and c["review_bucket"] == "candidate" and c["ai_suggestion"]["venue"] == "문화회관"
    assert "승인 후보 검증 실패 1" in summary


def test_missing_end_date_and_out_of_range_keep_review(monkeypatch, tmp_path):
    rows = [raw("e", "끝나는 날 없음", end=""), raw("f", "먼 공연", start=FAR, end=FAR)]
    db, _, _ = run(monkeypatch, tmp_path, rows, ids=["e", "f"])
    assert by_id(db, "e")["status"] == "REVIEW" and "날짜" in by_id(db, "e")["content"]["review_reason"]
    assert by_id(db, "f")["status"] == "REVIEW" and "공개 범위" in by_id(db, "f")["content"]["review_reason"]
    assert db.tables["events"] == []


def test_duplicate_beyond_first_1000_events(monkeypatch, tmp_path):
    events = [{"id": f"x{i:05d}", "title": f"다른 행사 {i}", "event_date_start": "2026-01-01", "region": "김해"}
              for i in range(1000)]
    events.append({"id": "z99999", "title": "기관 공연", "event_date_start": D1, "region": "김해"})
    db, _, _ = run(monkeypatch, tmp_path, [raw("g", "기관 공연")], events=events, ids=["g"])
    assert by_id(db, "g")["status"] == "DUPLICATE"
    assert len(db.tables["events"]) == 1001  # 새로 넣지 않았다


def test_approved_review_ids(monkeypatch):
    db = FakeDB([raw("h", "승인"), raw("i", "미승인", approved=False), raw("j", "공개됨", status="PUBLISHED")], [])
    assert pv.approved_review_ids(db) == ["h"]
