# Quickstart: 015 검증

1. **마이그레이션**: 익명 키로 `events?select=subcategory,subcategory_pending&limit=1`을 읽으면 200이다. `category=eq.체험·교육`인 공개 행사는 0건이다.
2. **판정 함수 시험**: `cd collector; python -m pytest tests/test_genre.py -q`를 돌리면 모두 통과한다.
3. **판정 적용**: `python tools/classify_genre.py`로 미리보기를 한 뒤 `--apply`로 적용한다. 마지막 줄에 대분류별 «확정 / 대기 / 미판정»이 나온다. KOPIS 장르 413건은 100% 확정, 전체 확정 비율은 80% 이상, 미판정은 0이어야 한다.
4. **표본 확인**: `--sample 30`으로 규칙 확정 30건(제목·세부·근거)을 뽑아 사람이 본다. 틀린 것이 3건 이하여야 한다. 결과를 verification.md에 적는다.
5. **필터 건수**: `/?category=공연&sub=뮤지컬`, `/?category=전시&sub=사진`, `/region/gimhae?category=공연&sub=클래식·오페라` 세 주소에서 화면 건수와 DB 건수(같은 조건)가 같아야 한다.
6. **화면**: 375×812에서 분야 «공연»을 고르면 세부 칩 줄이 나타나야 한다. 첫 화면에 포스터 3장이 계속 보여야 한다. 상세 꼬리표는 «공연 · 뮤지컬»로 보여야 한다.
7. **극장 영화**: 판정 함수에 «CGV 김해 개봉» 시험 행사를 넣으면 걸러지고, «독립영화 상영회»는 행사 › 상영회가 된다(pytest에 포함).
8. **빌드**: `npx tsc --noEmit`와 `next build --webpack`이 통과해야 한다.
