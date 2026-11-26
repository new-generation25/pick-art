"""tools/kakao_read_check.py 채점 함수 시험 (specs/017 이미지 읽기 자체 검증)"""
import io
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import kakao_read_check as k  # noqa: E402

T = {"title": "뮤지컬 〈빨래〉 - 김해", "start": "2026-12-05", "end": "2026-12-07", "venue": "김해문화의전당 누리홀", "region": "김해"}


def ai(title=None, start=None, end=None, venue=None, region=None):
    f = lambda v: {"raw": v, "value": v, "confidence": "high" if v else "none"}  # noqa: E731
    return {"title": f(title), "venue": f(venue), "region_hint": f(region), "date_start": start, "date_end": end}


def test_all_ok():
    s = k.score_item(ai("뮤지컬 빨래", "2026-12-05", "2026-12-07", "김해문화의전당 누리홀", "김해시"), T)
    assert s == {"state": "read", "title": "ok", "dates": "ok", "venue": "ok", "region": "ok"}


def test_empty_is_not_wrong():
    s = k.score_item(ai(), T)
    assert (s["title"], s["dates"], s["venue"], s["region"]) == ("empty", "empty", "empty", "empty")


def test_wrong_values():
    s = k.score_item(ai("오페라의 유령", "2026-12-06", "2026-12-07", "창원성산아트홀", "창원"), T)
    assert (s["title"], s["dates"], s["venue"], s["region"]) == ("wrong", "wrong", "wrong", "wrong")


def test_start_only_and_one_day():
    assert k.judge_dates("2026-12-05", "2026-12-06", "2026-12-05", "2026-12-07") == "start_ok"
    assert k.judge_dates("2026-12-05", None, "2026-12-05", "2026-12-05") == "ok"


def test_region_busan_gu():
    assert k.judge_region("부산 해운대구", "부산") == "ok"
    assert k.judge_region("부산광역시", "부산") == "ok"


def test_pending_and_failed():
    assert k.score_item(None, T)["state"] == "pending"
    assert k.score_item({"error": "흐림"}, T) == {"state": "failed", "error": "흐림"}


def test_summarize_counts():
    res = [{"score": k.score_item(ai("뮤지컬 빨래"), T)}, {"score": {"state": "pending"}}]
    s = k.summarize(res)
    assert s["read"] == 1 and s["pending"] == 1 and s["title"] == {"ok": 1} and s["dates"] == {"empty": 1}


def test_phone_photo_variants_are_jpeg_within_2048():
    from PIL import Image
    src = Image.new("RGB", (3000, 1200), (240, 240, 240))
    buf = io.BytesIO()
    src.save(buf, "PNG")
    for v in k.VARIANTS:
        out = k.phone_photo(buf.getvalue(), v, random.Random(1))
        im = Image.open(io.BytesIO(out))
        assert im.format == "JPEG" and max(im.size) <= 2048 and not im.getexif()


def test_word_subset_counts_as_same_place():
    assert k.similar("진주성 공북문앞 중영", "진주성 중영", 0.4)
    assert not k.similar("창원성산아트홀", "김해문화의전당", 0.4)


def test_region_falls_back_to_venue_match():
    a = ai("각기사방 해치세", venue="진주성 공북문앞 중영")
    a["venue_match"] = {"venue_id": "v", "name": "진주성 중영", "region": "진주"}
    assert k.score_item(a, {**T, "region": "진주", "venue": "진주성 중영"})["region"] == "ok"
