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
        rs = [r for r in self.rows.values() if r["status"] == "uploaded"
              and (r.get("image_path") or (r.get("channel") == "kakao_bot" and r.get("note")))]
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

    senders = None  # {sender_key: agreed_at}

    def expire_kakao(self, before_iso, apply):
        senders = self.senders or {}
        old = [k for k, t in senders.items() if t < before_iso]
        rows = [r for r in self.rows.values() if r.get("sender_key") and r["created_at"] < before_iso]
        if apply:
            for k in old:
                senders.pop(k)
            for r in rows:
                r["sender_key"] = None
        return len(old), len(rows)

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


@pytest.mark.parametrize("text", ["055-123-4567", "02-1234-5678", "1588-1234", "070-1234-5678",
                                  # 11/26 정확도 시험에서 계좌로 오판한 대표번호들
                                  "0507-1446-6715", "문의 | 0507-1446-6715 카톡채널", "0505-123-4567",
                                  "680-1051", "1599-1216", "1644-1234", "1800-1234", "055)864-6969",
                                  "(055)864-6969", "055.864.6969", "02)123-4567",
                                  "Tel. 673-0245 Tel. 674-7295", "673-0245 / 674-7295", "1599-1216 680-1051",
                                  "055-123-4567 055-765-4321", "하나은행 고객센터 1588-1111"])
def test_landline_not_mobile_nor_account(text):
    assert not lq.is_mobile(text) and not lq.is_account(text)


@pytest.mark.parametrize("text", ["농협 301-1234-5678-91 (예금주 극단)", "후원계좌 국민은행 123456-01-234567",
                                  "1002-123-456789", "입금 3333-01-2345678", "신한 110-123-456789",
                                  "110-1234-5678",        # 전화 모양 같아도 지역번호·대표번호가 아니면 11자리 계좌
                                  "02-1234-5678-901",     # 지역번호로 시작해도 하이픈으로 더 이어지면 계좌
                                  "1234567890123"])
def test_account_detected(text):
    assert lq.is_account(text)


@pytest.mark.parametrize("raw,value", [("680-1051", "680-1051"), ("문의 : 1599-1216", "1599-1216"),
                                       ("055)864-6969", "055)864-6969"),
                                       ("문의 | 0507-1446-6715 카톡채널", "0507-1446-6715"),
                                       ("Tel. 673-0245 Tel. 674-7295", "673-0245 / 674-7295")])
def test_privacy_checks_raw_and_value_separately(raw, value):
    # 예전에는 raw 와 value 를 빈칸으로 이어 붙여 «…1051 680…» 이 한 숫자 묶음(계좌)이 됐다
    assert lq.privacy_reason("contact", {"raw": raw, "value": value}) is None
    out, dropped = lq.validate(full(contact={"raw": raw, "value": value, "confidence": "high"}))
    assert dropped == [] and out["contact"]["value"] == value and out["personal_info_visible"] is False


@pytest.mark.parametrize("field,reason", [
    ({"raw": "문의 055-123-4567", "value": "010-1234-5678"}, "mobile"),   # value 쪽만 휴대전화
    ({"raw": "후원 농협 301-1234-5678-91", "value": "후원"}, "account"),  # raw 쪽만 계좌
    ({"raw": "+82 10-1234-5678", "value": None}, "mobile"),
])
def test_privacy_still_blocks_mobile_and_account(field, reason):
    assert lq.privacy_reason("contact", field) == reason


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
    ("2026.12.5(금)~7(일)", ("2026-12-05", "2026-12-07")),  # 끝날 월 생략 → 시작 월로 채움(11/26)
    # 끝날의 월이 빠진 줄임 표기 (11/26 정확도 시험 4dd6c85e)
    ("2027년 1월 9일~10일", ("2027-01-09", "2027-01-10")),
    ("2027년 1월 9일(토) ~ 10일(일)", ("2027-01-09", "2027-01-10")),
    ("2027. 1. 9 ~ 10", ("2027-01-09", "2027-01-10")),
    ("2027.1.9~10(일)", ("2027-01-09", "2027-01-10")),
    ("2027.1.9-10", ("2027-01-09", "2027-01-10")),
    ("2027. 1. 9.(토) ~ 10.(일)", ("2027-01-09", "2027-01-10")),
    ("2026. 9. 30 ~ 10. 1", ("2026-09-30", "2026-10-01")),   # 끝에 월이 있으면 그대로
    ("2026. 11.6.(금) - 11.10.(화)", ("2026-11-06", "2026-11-10")),
    ("2026년 12월 30일 ~ 3일", (None, None)),        # 채워도 끝이 앞섬 → 비움(연도 추측 안 함)
    ("1월 9일~10일", (None, None)),                  # 연도 없음 → 채우지 않음
    ("2026.12.15~17시", (None, None)),               # 시각 범위는 끝날로 늘리지 않음
    ("예선: 12월 04일(금) 본선: 12월 11일(금)", (None, None)),
    ("상시", (None, None)),
    ("일정 추후 공지", (None, None)),
    (None, (None, None)),
])
def test_parse_dates(raw, expected):
    assert lq.parse_dates(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("2027년 1월 9일~10일", "2027년 1월 9일~1월 10일"),
    ("2027. 1. 9 ~ 10", "2027. 1. 9 ~ 1. 10"),
    ("2027.1.9~10(일)", "2027.1.9~1. 10(일)"),
    ("2026.12.30 ~ 1.3", "2026.12.30 ~ 1.3"),        # 끝에 월이 있음 → 그대로
    ("2026.12.15~17시", "2026.12.15~17시"),          # 시각 → 그대로
    ("1월 9일~10일", "1월 9일~10일"),                # 연도 없음 → 그대로(연도를 넣지 않는다)
])
def test_normalize_abbrev_end(raw, expected):
    assert lq.normalize_abbrev_end(raw) == expected


def test_multiple_events_dates_not_parsed():
    raw = "2026. 09. 10. 10. 15. 11. 12. 12. 03."
    assert lq.parse_dates(raw) != (None, None)        # 그냥 파싱하면 첫날 하루로 바뀐다(오답)
    assert lq.parse_dates(raw, multiple_events=True) == (None, None)
    r = lq.build_result(full(multiple_events=True, date_text=f("2026.12.5(금)~12.7(일)")))
    assert r["date_start"] is None and r["date_end"] is None
    assert r["date_text"]["raw"] == "2026.12.5(금)~12.7(일)"   # 글자는 남긴다


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
    assert items[0]["file"] is None and "download_error" in items[0] and items[0]["tiles"] == []


def _png(w, h):
    import io
    from PIL import Image
    buf = io.BytesIO()
    im = Image.new("RGB", (w, h), "white")
    im.paste((0, 0, 0), (0, 0, w, h // 4))          # 위쪽 검은 띠(위 조각에만 들어가야 함)
    im.save(buf, "PNG")
    return buf.getvalue()


def test_pending_writes_zoom_tiles(tmp_path):
    from PIL import Image
    store = FakeStore([row(path=f"u1/{SID}.png")], {f"u1/{SID}.png": _png(300, 400)})
    items = lq.pending(store, 10, cache_dir=str(tmp_path))
    tiles = items[0]["tiles"]
    assert tiles == [str(tmp_path / f"{SID}.tile1.jpg"), str(tmp_path / f"{SID}.tile2.jpg")]
    with Image.open(tiles[0]) as top, Image.open(tiles[1]) as bottom:
        assert top.width == 600 and bottom.width == 600          # 2배
        assert 400 <= top.height <= 480 and 400 <= bottom.height <= 480   # 절반(+겹침) × 2
        assert top.getpixel((300, 10))[0] < 50                   # 위 조각 = 위 절반
        assert bottom.getpixel((300, bottom.height - 10))[0] > 200


def test_pending_tile_error_does_not_block(tmp_path):
    store = FakeStore([row()], {f"u1/{SID}.jpg": b"not an image"})
    items = lq.pending(store, 10, cache_dir=str(tmp_path))
    assert items[0]["file"] and items[0]["tiles"] == [] and "tiles_error" in items[0]


def test_save_and_fail_remove_tiles(tmp_path):
    store = FakeStore([row(path=f"u1/{SID}.png")], {f"u1/{SID}.png": _png(100, 120)})
    lq.pending(store, 10, cache_dir=str(tmp_path))
    assert len(list(tmp_path.glob(f"{SID}.*"))) == 3             # 원본 + 조각 2
    res = tmp_path / f"{SID}.json"
    res.write_text(json.dumps(full(title=f("작은 음악회"))), encoding="utf-8")
    ok, _ = lq.save(store, SID, str(res), cache_dir=str(tmp_path))
    assert ok and list(tmp_path.glob(f"{SID}.*")) == []

    other = "dddddddd-2222-3333-4444-555555555555"
    store = FakeStore([row(sid=other, path=f"u1/{other}.png")], {f"u1/{other}.png": _png(100, 120)})
    lq.pending(store, 10, cache_dir=str(tmp_path))
    assert len(list(tmp_path.glob(f"{other}.*"))) == 3
    assert lq.fail(store, other, "흐림", cache_dir=str(tmp_path))
    assert list(tmp_path.glob(f"{other}.*")) == []


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


def test_representative_number_does_not_set_personal_info_visible():
    # 대표번호만 있으면 칸도 남고 «포스터 공개 안 함»도 켜지지 않는다(11/26 오탐 4장)
    for raw, value in [("680-1051", "680-1051"), ("문의 : 1599-1216", "1599-1216"),
                       ("055)864-6969", "055)864-6969"), ("문의 | 0507-1446-6715", "0507-1446-6715")]:
        out, dropped = lq.validate(full(contact={"raw": raw, "value": value, "confidence": "high"}))
        assert dropped == [] and out["personal_info_visible"] is False and out["contact"]["value"] == value
    # 예약작업이 직접 true 로 표시한 것은 그대로 둔다
    out, _ = lq.validate(full(personal_info_visible=True, contact=f("055-123-4567")))
    assert out["personal_info_visible"] is True


def test_pending_kakao_text_only_row(tmp_path):
    """specs/017: 카카오 챗봇으로 글만 보낸 제출은 내려받지 않고 source=text 로 넘긴다. 사이트 제출의 빈 경로는 넘기지 않는다"""
    tid = "cccccccc-2222-3333-4444-555555555555"
    r = row(sid=tid, path=None)
    r.update(channel="kakao_bot", note="12월 5일 저녁 7시 김해문화의전당 연극 «겨울 손님»")
    web_empty = row(sid="dddddddd-2222-3333-4444-555555555555", path=None)
    items = lq.pending(FakeStore([r, web_empty]), 10, cache_dir=str(tmp_path))
    assert [x["id"] for x in items] == [tid]
    assert items[0]["source"] == "text" and items[0]["file"] is None and "download_error" not in items[0]
    assert items[0]["text"].startswith("12월 5일") and items[0]["channel"] == "kakao_bot"


def test_cleanup_expires_kakao_sender_keys():
    """specs/017: 1년 지난 카카오 보낸 사람 구분값(동의 기록·제출의 sender_key)도 지운다"""
    old = row(sid="eeeeeeee-2222-3333-4444-555555555555", path=None)
    old.update(channel="kakao_bot", sender_key="a" * 64, created_at="2025-01-01T00:00:00+00:00")
    new = row(sid="ffffffff-2222-3333-4444-555555555555", path=None)
    new.update(channel="kakao_bot", sender_key="b" * 64, created_at="2026-11-20T00:00:00+00:00")
    store = FakeStore([old, new])
    store.senders = {"a" * 64: "2025-01-01T00:00:00+00:00", "b" * 64: "2026-11-20T00:00:00+00:00"}
    now = lq.datetime(2026, 11, 26, tzinfo=lq.timezone.utc)
    dry = lq.cleanup(store, False, now=now)
    assert (dry["kakao_senders"], dry["kakao_sender_keys"]) == (1, 1) and store.rows[old["id"]]["sender_key"]
    out = lq.cleanup(store, True, now=now)
    assert (out["kakao_senders"], out["kakao_sender_keys"]) == (1, 1)
    assert store.rows[old["id"]]["sender_key"] is None and store.rows[new["id"]]["sender_key"] == "b" * 64
    assert list(store.senders) == ["b" * 64]


# ---------- 장소 목록 맞추기 (11/27 카카오 제보 읽기 검증에서 더함) ----------

VENUES = [
    {"id": "v1", "name": "진해아트홀", "aliases": [], "region": "창원"},
    {"id": "v2", "name": "진주성 중영", "aliases": ["진주성 내 중영"], "region": "진주"},
    {"id": "v3", "name": "경상남도문화예술회관", "aliases": [], "region": "진주"},
    {"id": "v4", "name": "김해문화의전당", "aliases": [], "region": "김해"},
    {"id": "v5", "name": "영화의전당", "aliases": [], "region": "부산"},
    {"id": "v6", "name": "대공연장", "aliases": [], "region": "통영"},
    {"id": "v7", "name": "문화회관", "aliases": [], "region": "거제"},
    {"id": "v8", "name": "문화회관", "aliases": [], "region": "밀양"},
]


def test_match_venue_tokens_and_spacing():
    assert lq.match_venue("진해아트홀 공연장 (충장로 653)", VENUES)["region"] == "창원"
    assert lq.match_venue("진주성 공북문앞 중영", VENUES)["region"] == "진주"      # 낱말이 떨어져 있어도
    assert lq.match_venue("부산 영화의 전당 하늘연극장", VENUES)["region"] == "부산"  # 띄어 쓴 이름도
    assert lq.match_venue("김해문화의전당 마루홀", VENUES)["venue_id"] == "v4"


def test_match_venue_refuses_ambiguous_or_bare():
    assert lq.match_venue("대공연장", VENUES)["venue_id"] == "v6"   # 목록에 같은 이름이 있으면 맞는다(4자 이상)
    assert lq.match_venue("문화회관 소공연장", VENUES) is None       # 같은 이름이 두 지역 → 고르지 않음
    assert lq.match_venue("소향씨어터", VENUES) is None              # 목록에 없음
    assert lq.match_venue("", VENUES) is None


def test_save_adds_venue_match(tmp_path):
    class S(FakeStore):
        def venues(self):
            return VENUES
    store = S([row()])
    p = tmp_path / "r.json"
    p.write_text(json.dumps(full(venue=f("진해아트홀 공연장")), ensure_ascii=False), encoding="utf-8")
    ok, result = lq.save(store, SID, str(p), cache_dir=str(tmp_path))
    assert ok and result["venue_match"] == {"venue_id": "v1", "name": "진해아트홀", "region": "창원"}


@pytest.mark.parametrize("raw,expect", [
    ("2026.2.24 —2027.8.29", ("2026-02-24", "2027-08-29")),        # 긴 줄표, 연도 넘김
    ("2026. 04. 17. — 11. 29.", ("2026-04-17", "2026-11-29")),     # 긴 줄표, 끝에 연도 없음
    ("2026. 11. 21. ― 12. 4", ("2026-11-21", "2026-12-04")),       # 가로 막대
    ("2026. 11.17. – 2027. 5.30.", ("2026-11-17", "2027-05-30")),  # en dash
    ("2026. 11. 21. - 12. 4", ("2026-11-21", "2026-12-04")),       # 하이픈(원래 되던 것)
    ("2026.12.18(금) - 27(일)", ("2026-12-18", "2026-12-27")),      # 줄임 끝날(원래 되던 것)
])
def test_long_dash_period_keeps_end(raw, expect):
    assert lq.parse_dates(raw) == expect


@pytest.mark.parametrize("raw,expect", [
    ("2026. 11. 27. (금) | 28. (토)", ("2026-11-27", "2026-11-28")),   # 검증 11/27에서 나온 것
    ("2026. 12. 5(토), 6(일)", ("2026-12-05", "2026-12-06")),
    ("2026.12.30(수) / 1.2(토)", ("2026-12-30", "2027-01-02")),         # 해 넘김 나열
    ("2026. 12. 6.[일]", ("2026-12-06", "2026-12-06")),                 # 하루짜리는 그대로
    ("2026. 12. 6.(일) 19:30", ("2026-12-06", "2026-12-06")),           # 시각은 나열이 아님
    ("2026.4.13.(월) ~ 예산 소진 시까지", (None, None)),                  # 끝이 날짜가 아니면 비움(원래대로)
])
def test_listed_dates_keep_last_day(raw, expect):
    assert lq.parse_dates(raw) == expect
