"""중복 검수 시험 (2026-11-26 실제 사례). collector 폴더에서: python -m pytest tests/test_dedupe.py -q"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dedupe import keep_rank, loose, same_event  # noqa: E402
from tools.dedupe_published import find_dupes  # noqa: E402


def ev(title, source, region, start, end, id_):
    return {"id": id_, "title": title, "source": source, "region": region, "event_date_start": start, "event_date_end": end}


def test_bracket_title_not_empty():
    # 예전 loose 는 「연극 [더 드레서]」를 빈 문자열로 만들었다
    assert loose("연극 [더 드레서]") == "더드레서"
    assert loose("더 드레서 [김해]") == "더드레서"
    assert loose("[김해]") != ""  # 지역만 있는 제목도 비지 않게(기호만 뺀 원래 제목)


def test_the_dresser_gimhae():
    kopis = ev("더 드레서 [김해]", "KOPIS", "김해", "2026-12-11", "2026-12-12", "415590c4")
    hall = ev("연극 [더 드레서]", "김해문화의전당", "김해", "2026-12-11", "2026-12-12", "a9d85809")
    assert same_event(kopis, hall)
    pairs = find_dupes([hall, kopis])
    assert [(k["id"], d["id"]) for k, d in pairs] == [("415590c4", "a9d85809")]  # KOPIS 를 남긴다


def test_la_traviata_haman():
    kopis = ev("라 트라비아타 [함안]", "KOPIS", "함안", "2026-11-20", "2026-11-20", "c0b953e4")
    hall = ev("오페라 라 트라비아타", "함안문화예술회관", "함안", "2026-11-20", "2026-11-20", "ec9fcc3a")
    other = ev("오페라 라 트라비아타", "창원문화재단", "창원", "2026-11-26", "2026-11-27", "bd1b32bb")  # 다른 지역·날짜
    assert same_event(kopis, hall)
    assert not same_event(kopis, other)
    assert [(k["id"], d["id"]) for k, d in find_dupes([kopis, hall, other])] == [("c0b953e4", "ec9fcc3a")]


def test_jazz_festival_bundle_not_duplicate():
    bundle = ev("2026 진주국제재즈페스티벌", "진주시 우리 지역 행사·축제", "진주", "2026-12-01", "2026-12-05", "64c75489")
    day = ev("제9회 진주국제재즈페스티벌 (12.01)", "KOPIS", "진주", "2026-12-01", "2026-12-01", "e23549b6")
    assert not same_event(bundle, day)
    assert find_dupes([bundle, day]) == []


def test_rank_prefers_kopis():
    assert keep_rank({"source": "KOPIS"}) < keep_rank({"source": "김해문화의전당"}) < keep_rank({"source": "인스타그램"})
