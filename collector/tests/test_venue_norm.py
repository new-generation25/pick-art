"""venue_norm 규칙 검사 (specs/002-nearby-events T009). 실행: collector 폴더에서 python -m unittest tests.test_venue_norm"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from venue_norm import decide, haversine_m, naver_to_wgs84, normalize_venue  # noqa: E402

# 운영 DB(2026-11-21)의 실제 표기
NORM_CASES = {
    "해운대문화회관\xa0고운홀": "해운대문화회관",
    "해운대문화회관\xa0해운홀": "해운대문화회관",
    "해운대문화회관\xa0제2전시실": "해운대문화회관",
    "해운대문화회관 (고운홀)": "해운대문화회관",
    "부산문화회관 (중극장)": "부산문화회관",
    "부산문화회관 챔버홀": "부산문화회관",
    "부산문화회관 전시실": "부산문화회관",
    "창원문화재단 성산아트홀 대극장": "성산아트홀",
    "창원문화재단 성산아트홀 제5전시실": "성산아트홀",
    "성산아트홀 (대극장)": "성산아트홀",
    "창원문화재단 3·15 아트홀 제2전시실": "3·15아트홀",
    "3·15아트홀 제3전시실": "3·15아트홀",
    "통영시민문화회관 (대극장)": "통영시민문화회관",
    "통영시민문화회관 2전시관": "통영시민문화회관",
    "경상남도문화예술회관 제2전시실(1층 전시실)": "경상남도문화예술회관",
    "경상남도문화예술회관 대공연장": "경상남도문화예술회관",
    "벡스코 (BEXCO) (제1전시장 1홀)": "벡스코",
    "벡스코 (BEXCO) (오디토리움)": "벡스코",
    "영화의전당 다목적홀(전시실)": "영화의전당",
    "김해문화의전당 (마루홀)": "김해문화의전당",
    "김해문화의전당": "김해문화의전당",
    "거제문화예술회관 대극장": "거제문화예술회관",
    "낙동아트센터 (앙상블극장)": "낙동아트센터",
    "F1963 (석천홀)": "F1963",
    "공간소극장 [대연역]": "공간소극장",
    "필슈파스 [부산진구] (필슈파스 (4F) )": "필슈파스",
    "드리운 스튜디오  (드리운 스튜디오)": "드리운 스튜디오",
    "진주성 내 중영": "진주성 내 중영",
    "부산 아르떼홀": "부산 아르떼홀",
    "부산예술회관": "부산예술회관",
}


def cand(name, address, lat, lng):
    return {"name": name, "address": address, "lat": lat, "lng": lng}


class NormalizeTest(unittest.TestCase):
    def test_real_spellings(self):
        for raw, want in NORM_CASES.items():
            with self.subTest(raw=raw):
                self.assertEqual(normalize_venue(raw), want)

    def test_empty(self):
        self.assertEqual(normalize_venue(""), "")
        self.assertEqual(normalize_venue(None), "")


class CoordTest(unittest.TestCase):
    def test_naver_wgs84(self):
        self.assertEqual(naver_to_wgs84("1291586000", "351530000"), (35.153, 129.1586))

    def test_naver_old_katec_rejected(self):
        # 문서 예시의 옛 KATECH 값(311277, 552097)은 한국 범위 밖으로 나와 None
        self.assertIsNone(naver_to_wgs84("311277", "552097"))

    def test_haversine_known(self):
        # 부산역(35.1151, 129.0415) ↔ 해운대역(35.1631, 129.1586) ≈ 11.8km
        d = haversine_m(35.1151, 129.0415, 35.1631, 129.1586)
        self.assertAlmostEqual(d / 1000, 11.8, delta=0.3)


class DecideTest(unittest.TestCase):
    def test_confirm_single(self):
        st, c = decide("해운대문화회관", "부산", [cand("<b>해운대문화회관</b>", "부산광역시 해운대구 양운로 97", 35.172, 129.176)])
        self.assertEqual(st, "confirmed")
        self.assertEqual(c["lat"], 35.172)

    def test_no_result_failed(self):
        self.assertEqual(decide("없는곳", "부산", [])[0], "failed")

    def test_wrong_region_pending(self):
        st, _ = decide("문화회관", "김해", [cand("문화회관", "부산광역시 중구 ...", 35.1, 129.03)])
        self.assertEqual(st, "pending")

    def test_outside_gyeongnam_pending(self):
        st, _ = decide("아트홀", "부산", [cand("아트홀", "부산광역시 ...", 37.5, 127.0)])  # 서울 좌표
        self.assertEqual(st, "pending")

    def test_name_mismatch_pending(self):
        st, _ = decide("작업실", "진주", [cand("진주 카페 작업실2", "경상남도 진주시 ...", 35.18, 128.08)])
        # 이름은 포함 관계라 맞지만 아래 동명 다점 테스트와 구분: 단일 후보면 확정
        self.assertEqual(st, "confirmed")
        st2, _ = decide("공간소극장", "부산", [cand("부산 공간카페", "부산광역시 남구 ...", 35.13, 129.09)])
        self.assertEqual(st2, "pending")

    def test_two_same_name_far_pending(self):
        cs = [cand("작업실", "경상남도 진주시 A", 35.18, 128.08), cand("작업실", "경상남도 진주시 B", 35.20, 128.12)]
        self.assertEqual(decide("작업실", "진주", cs)[0], "pending")

    def test_two_same_name_near_confirmed(self):
        cs = [cand("벡스코", "부산광역시 해운대구 APEC로 55", 35.1690, 129.1361),
              cand("벡스코 제2전시장", "부산광역시 해운대구 APEC로 55", 35.1700, 129.1370)]
        self.assertEqual(decide("벡스코", "부산", cs)[0], "confirmed")


if __name__ == "__main__":
    unittest.main()
