"""tools/leaflet_queue.py 검사·날짜 변환·개인정보 거르기·저장 흐름(가짜 DB·버킷, 네트워크 없음).
실행: python -m pytest collector/tests -q"""
import json
import os
import sys
from datetime import datetime, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import leaflet_queue as lq  # noqa: E402

SID = "11111111-2222-3333-4444-555555555555"


def f(raw, value=None, conf="high"):
    return {"raw": raw, "value": raw if value is None else value, "confidence": conf}


def empty():
    return {"raw": None, "value": None, "confidence": "none"}


def full(**over):
    d = {k: empty() for k in lq.TEXT_FIELDS}
    d["multiple_events"] = False
    d.update(over)
    return d


class FakeStore:
    def __init__(self, rows=None, files=None):
        self.rows = {r["id"]: dict(r) for r in (rows or [])}
        self.files = dict(files or {})
        self.removed = []

    def pending(self, limit):
        rs = [r for r in self.rows.values() if r["status"] == "uploaded" and r.get("image_path")]
        return sorted(rs, key=lambda r: r["created_at"])[:limit]

    def download(self, path):
        if path not in self.files:
            raise RuntimeError("Object not found")
        return self.files[path]

    def mark_read(self, sid, ai_result, read_at):
        r = self.rows.get(sid)
        if not r or r["status"] != "uploaded":
            return False
        r.update(ai_result=ai_result, ai_read_at=read_at, status="read")
        return True

    def status_of(self, sid):
        return self.rows.get(sid, {}).get("status")

    def expired(self, before_iso):
        return [{"id": r["id"], "image_path": r["image_path"], "created_at": r["created_at"]}
                for r in self.rows.values() if r["created_at"] < before_iso and r.get("image_path")]

    def remove_files(self, paths):
        self.removed += paths
        for p in paths:
            self.files.pop(p, None)

    def clear_image_path(self, sid, path):
        r = self.rows.get(sid)
        if r and r.get("image_path") == path:
            r["image_path"] = None
            return True
        return False


# ---------- 검사 ----------

def test_unknown_key_rejected():
    with pytest.raises(lq.ValidationError):
        lq.validate(full(description=f("소개 글")))


def test_bad_shapes_rejected():
    with pytest.raises(lq.ValidationError):
        lq.validate(full(title="제목만 문자열"))
    with pytest.raises(lq.ValidationError):
        lq.validate(full(title={"raw": "a", "value": "a", "confidence": "maybe"}))
    with pytest.raises(lq.ValidationError):
        lq.validate(full(title={"raw": "a", "value": "a"}))
    with pytest.raises(lq.ValidationError):
        lq.validate(full(title={"raw": 1, "value": "a", "confidence": "high"}))
    with pytest.raises(lq.ValidationError):
        lq.validate(full(multiple_events="no"))
    with pytest.raises(lq.ValidationError):
        lq.validate([])


def test_missing_fields_become_none_and_lengths_trimmed():
    out, dropped = lq.validate({"title": f("가" * 500)})
    assert len(out["title"]["raw"]) == 300 and len(out["title"]["value"]) == 300
    assert out["venue"] == empty()
    assert out["multiple_events"] is False and dropped == []


def test_confidence_none_clears_value_and_blank_becomes_none():
    out, _ = lq.validate(full(venue={"raw": "흐릿한 글자", "value": "어딘가", "confidence": "none"},
                              organizer={"raw": "  ", "value": "", "confidence": "high"}))
    assert out["venue"] == {"raw": "흐릿한 글자", "value": None, "confidence": "none"}
    assert out["organizer"] == empty()


def test_booking_url_must_be_http():
    out, _ = lq.validate(full(booking_url=f("www.ticket.co.kr")))
    assert out["booking_url"]["value"] is None and out["booking_url"]["raw"] == "www.ticket.co.kr"
    out, _ = lq.validate(full(booking_url=f("javascript:alert(1)")))
    assert out["booking_url"]["value"] is None
    out, _ = lq.validate(full(booking_url=f("https://ticket.example.kr/1")))
    assert out["booking_url"]["value"] == "https://ticket.example.kr/1"


# ---------- 개인정보 ----------

@pytest.mark.parametrize("text", ["010-1234-5678", "문의 010.1234.5678", "01012345678", "011-123-4567",
                                  "019 1234 5678", "+82 10-1234-5678", "(010)1234-5678"])
def test_mobile_detected(text):
    assert lq.is_mobile(text)


@pytest.mark.parametrize("text", ["055-123-4567", "02-1234-5678", "1588-1234", "070-1234-5678"])
def test_landline_not_mobile_nor_account(text):
    assert not lq.is_mobile(text) and not lq.is_account(text)


@pytest.mark.parametrize("text", ["농협 301-1234-5678-91 (예금주 극단)", "후원계좌 국민은행 123456-01-234567",
                                  "1002-123-456789", "입금 3333-01-2345678"])
def test_account_detected(text):
    assert lq.is_account(text)


@pytest.mark.parametrize("text", ["R석 50,000원 / S석 30,000원", "2026-12-05", "전석 무료", "우리 동네 음악회"])
def test_ordinary_text_not_account(text):
    assert not lq.is_account(text)


def test_contact_mobile_and_account_dropped():
    out, dropped = lq.validate(full(contact=f("문의 010-9876-5432"),
                                    booking_text=f("후원 농협 301-1234-5678-91"),
                                    organizer=f("극단 예시")))
    assert out["contact"] == empty() and out["booking_text"] == empty()
    assert out["organizer"]["value"] == "극단 예시"
    assert {"field": "contact", "reason": "mobile"} in dropped
    assert {"field": "booking_text", "reason": "account"} in dropped
    assert "9876" not in json.dumps(out, ensure_ascii=False)


def test_group_landline_kept():
    out, dropped = lq.validate(full(contact=f("문의 055-330-1234")))
    assert out["contact"]["value"] == "문의 055-330-1234" and dropped == []


def test_date_text_not_flagged_as_account():
    out, dropped = lq.validate(full(date_text=f("2026-12-05 2026-12-07")))
    assert out["date_text"]["raw"] == "2026-12-05 2026-12-07" and dropped == []


# ---------- 날짜 (rule_extractor.parse_period, 기본 연도 없음) ----------

@pytest.mark.parametrize("raw,expected", [
    ("2026.12.5(금)~12.7(일)", ("2026-12-05", "2026-12-07")),
    ("2026년 12월 5일(금) 오후 7시 30분", ("2026-12-05", "2026-12-05")),
    ("2026.10.03(토) ~ 2026.10.04(일)", ("2026-10-03", "2026-10-04")),
    ("12.5(금)~12.7(일)", (None, None)),            # 연도 없음 → 추측하지 않는다
    ("12월 5일 19:30", (None, None)),
    ("2026.12.30 ~ 1.3", (None, None)),             # 끝이 앞섬(연도 넘김 추측 필요) → 비움
    ("2026.12.5(금)~7(일)", (None, None)),           # 끝을 못 읽음 → 비움
    ("상시", (None, None)),
    ("일정 추후 공지", (None, None)),
    (None, (None, None)),
])
def test_parse_dates(raw, expected):
    assert lq.parse_dates(raw) == expected


def test_build_result_uses_raw_not_value_for_dates():
    r = lq.build_result(full(date_text={"raw": "12.5(금)", "value": "2026-12-05", "confidence": "high"}))
    assert r["date_start"] is None and r["date_end"] is None
    assert r["read_by"] == "claude-scheduled" and r["date_parser"] == "rule_extractor.parse_period"


# ---------- 흐름 ----------

def row(sid=SID, status="uploaded", path=f"u1/{SID}.jpg", created="2026-11-26T01:00:00+00:00", **kw):
    return {"id": sid, "status": status, "image_path": path, "created_at": created, "image_kind": "photo",
            "group_name": "극단 예시", "official_url": None, "given": {"title": "직접 적은 제목"}, "note": None, **kw}


def test_pending_downloads_into_cache(tmp_path):
    other = "aaaaaaaa-2222-3333-4444-555555555555"
    store = FakeStore([row(), row(sid=other, path=None), row(sid="bbbbbbbb-2222-3333-4444-555555555555",
                                                             status="read")],
                      {f"u1/{SID}.jpg": b"JPEGDATA"})
    items = lq.pending(store, 10, cache_dir=str(tmp_path))
    assert [x["id"] for x in items] == [SID]
    assert items[0]["file"] == str(tmp_path / f"{SID}.jpg")
    with open(items[0]["file"], "rb") as fh:
        assert fh.read() == b"JPEGDATA"
    assert items[0]["image_kind"] == "photo" and items[0]["given"] == {"title": "직접 적은 제목"}


def test_pending_download_error_reported(tmp_path):
    items = lq.pending(FakeStore([row()]), 10, cache_dir=str(tmp_path))
    assert items[0]["file"] is None and "download_error" in items[0]


def test_save_marks_read_and_removes_cache(tmp_path):
    store = FakeStore([row()])
    img = tmp_path / f"{SID}.jpg"
    img.write_bytes(b"x")
    res = tmp_path / f"{SID}.json"
    res.write_text(json.dumps(full(title=f("작은 음악회"), date_text=f("2026.12.5(금)"),
                                   contact=f("010-1111-2222")), ensure_ascii=False), encoding="utf-8")
    ok, result = lq.save(store, SID, str(res), cache_dir=str(tmp_path))
    assert ok and store.rows[SID]["status"] == "read" and store.rows[SID]["ai_read_at"]
    saved = store.rows[SID]["ai_result"]
    assert saved["title"]["value"] == "작은 음악회"
    assert (saved["date_start"], saved["date_end"]) == ("2026-12-05", "2026-12-05")
    assert saved["contact"] == empty()
    assert not img.exists() and not res.exists()


def test_save_skips_row_not_uploaded(tmp_path):
    store = FakeStore([row(status="read", ai_result={"old": 1})])
    res = tmp_path / "r.json"
    res.write_text(json.dumps(full()), encoding="utf-8")
    ok, _ = lq.save(store, SID, str(res), cache_dir=str(tmp_path))
    assert not ok and store.rows[SID]["ai_result"] == {"old": 1}


def test_save_invalid_json_writes_nothing(tmp_path):
    store = FakeStore([row()])
    res = tmp_path / "r.json"
    res.write_text(json.dumps(full(summary=f("지어낸 소개"))), encoding="utf-8")
    with pytest.raises(lq.ValidationError):
        lq.save(store, SID, str(res), cache_dir=str(tmp_path))
    assert store.rows[SID]["status"] == "uploaded"


def test_bad_id_rejected(tmp_path):
    with pytest.raises(lq.ValidationError):
        lq.fail(FakeStore(), "../../etc", "x", cache_dir=str(tmp_path))


def test_fail_records_error(tmp_path):
    store = FakeStore([row()])
    assert lq.fail(store, SID, "  빛 반사로   글자를 못 읽음 ", cache_dir=str(tmp_path))
    assert store.rows[SID]["status"] == "read"
    assert store.rows[SID]["ai_result"]["error"] == "빛 반사로 글자를 못 읽음"


def test_cleanup_dry_run_and_apply():
    old = "cccccccc-2222-3333-4444-555555555555"
    store = FakeStore([row(), row(sid=old, status="published", path=f"u1/{old}.png",
                                  created="2025-11-01T00:00:00+00:00")],
                      {f"u1/{old}.png": b"p", f"u1/{SID}.jpg": b"j"})
    now = datetime(2026, 11, 26, tzinfo=timezone.utc)
    dry = lq.cleanup(store, False, now=now)
    assert dry["expired"] == 1 and dry["files_removed"] == 0 and store.rows[old]["image_path"]
    done = lq.cleanup(store, True, now=now)
    assert done["files_removed"] == 1 and done["rows_cleared"] == 1
    assert store.removed == [f"u1/{old}.png"] and store.rows[old]["image_path"] is None
    assert store.rows[SID]["image_path"] == f"u1/{SID}.jpg"


def test_personal_info_visible_flag():
    # 예약작업이 표시하면 그대로, 없으면 False
    out, _ = lq.validate(full(personal_info_visible=True))
    assert out["personal_info_visible"] is True
    out, _ = lq.validate(full())
    assert out["personal_info_visible"] is False
    with pytest.raises(lq.ValidationError):
        lq.validate(full(personal_info_visible="yes"))


def test_dropped_contact_sets_personal_info_visible():
    # 칸에 휴대전화가 들어와 걸러졌다면 이미지에도 보인다는 뜻 → 포스터로 쓰지 않게 표시
    d = full()
    d["contact"] = {"raw": "문의 010-1234-5678", "value": "010-1234-5678", "confidence": "high"}
    out, dropped = lq.validate(d)
    assert dropped and out["personal_info_visible"] is True
