"""specs/015 세부 갈래 판정 시험 (collector 폴더에서: python -m pytest tests/test_genre.py -q)"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from genre import classify, is_theater_film, normalize_category  # noqa: E402


def c(title, category, description=""):
    return classify({"title": title, "category": category, "description": description})


def test_kopis_mapping():
    assert c("어떤 공연", "공연", "줄거리\n장르: 서양음악(클래식)")[1:3] == ("클래식·오페라", "kopis")
    assert c("어떤 공연", "공연", "장르: 대중무용")[1] == "무용"
    assert c("어떤 공연", "공연", "장르: 복합")[1] == "복합·기타"


def test_performance_rules():
    assert c("김경미 피아노 독주회", "공연")[1] == "클래식·오페라"
    assert c("부산시립국악관현악단 정기연주회", "공연")[1] == "국악·전통연희"  # 국악이 관현악보다 앞
    assert c("창작뮤지컬 〈흔, 적〉", "공연")[1] == "뮤지컬"
    assert c("발레 피터팬", "공연")[1] == "무용"
    assert c("퍼펙트 일루전 매직콘서트", "공연")[1] == "서커스·마술"


def test_ambiguous_goes_pending():
    cat, sub, by, ev, pending = c("2026 송년음악회", "공연")
    assert sub is None and pending is True and by is None
    assert c("2026 정기전", "전시")[4] is True


def test_exhibition_rules():
    assert c("해운대사진가회 제25회 회원전", "전시")[1] == "사진"
    assert c("제10회 창원서예작가협회전", "전시")[1] == "서예"
    assert c("인터렉티브 미디어 아트전", "전시")[1] == "미디어"
    assert c("제21회 김해공예협회전", "전시")[1] == "공예"
    assert c("2026 창원조각비엔날레 <공명장>", "전시")[1] == "조각·설치"


def test_festival_fallback_and_art():
    assert c("제42회 김해진영단감축제", "축제")[1] == "지역축제"
    assert c("거제예술제", "축제")[1] == "문화예술축제"


def test_events_and_experience():
    assert c("김영미 작가 『이것이 진짜 아프리카다』 순회 북토크", "행사")[1] == "강연·북토크"
    assert c("불암 무비피크닉 〈코코〉", "행사")[1] == "상영회"
    assert c("어린이 플리마켓 젤리마켓", "행사")[1] == "마켓"
    assert c("함안 목재교육 입문과정 2기", "체험")[1] == "교육·강좌"
    assert c("가을을 담은 플라워 클래스", "체험")[1] == "체험·워크숍"


def test_merge_experience():
    assert normalize_category("체험·교육") == "체험"
    assert c("일일 공예 클래스", "체험·교육")[0:2] == ("체험", "체험·워크숍")


def test_screening_moves_to_event():
    assert c("2026 창원역사민속관 명작영화콜랙숀", "공연")[0:2] == ("행사", "상영회")
    assert c("독립영화 상영회", "전시")[0:2] == ("행사", "상영회")
    # 영화음악 콘서트는 공연으로 남는다
    assert c("2026 11시 영화음악콘서트 11월 <합창으로 듣는 영화음악>", "공연")[0] == "공연"


def test_theater_film():
    assert is_theater_film({"title": "신작 개봉작 상영", "venue": "CGV 김해"})
    assert not is_theater_film({"title": "독립영화 상영회", "venue": "김해문화의전당"})
