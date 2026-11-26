# Tasks: 행사 분류 두 단계

**Input**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md)

## Phase 1: Foundational

- [X] T001 마이그레이션 `supabase/migrations/20261127020000_genre.sql`을 만든다.
  - data-model.md의 네 칸과 CHECK `events_subcategory_valid`(대분류별 허용 목록)를 더한다.
  - `subcategory_evidence`는 ≤200자로 한다.
  - `체험·교육`을 `체험`으로 바꾼다(`events`, `profiles.interests`).
- [X] T002 T001을 운영 DB에 적용하고 익명 키로 확인한다 (quickstart 1).
- [X] T003 [P] 규칙 파일 `collector/rules/genre_rules.json`을 만든다. 대분류별 «세부 ← 단서 낱말», KOPIS 장르 대응, 극장 영화 낱말, 상영회 낱말을 담는다.
- [X] T004 [P] 판정 함수 `collector/genre.py`를 만든다.
  - `normalize_category`, `kopis_genre(description)`, `classify(event) -> (sub|None, evidence, pending)`, `is_theater_film(event)`.
  - 시험 `collector/tests/test_genre.py`를 붙인다.

## Phase 2: US2 자동 판정 (P1)

- [X] T005 [US2] 판정 도구 `collector/tools/classify_genre.py`를 만든다.
  - 미리보기, `--apply`, `--sample N`.
  - `subcategory_by='admin'` 행은 건너뛴다.
  - 마지막 줄에 요약을 낸다.
- [X] T006 [US2] 미리보기 → 적용 → 표본 30건 확인. 결과를 `specs/015-genre-taxonomy/verification.md`에 적는다 (quickstart 3·4).
- [X] T007 [US2] 정기 루틴 `collector/main.py`에 `classify_genre.py --apply`를 붙인다. 공개 검증 `collector/tools/publish_verified.py`에는 `normalize_category`와 극장 영화 거르기를 넣는다.

## Phase 3: US1 세부 필터·꼬리표 (P1) · US4 체험 합치기 (P2)

- [X] T008 [US1][US4] `frontend/src/lib/categories.ts`를 고친다.
  - «체험»으로 바꾼다.
  - `SUBCATEGORIES`를 더한다.
  - 예전 이름 «체험·교육»을 «체험»으로 읽는 대응을 넣는다.
- [X] T009 [US1] `frontend/src/components/HomeFeed.tsx`를 고친다.
  - `?sub=`로 거르고, 세부별 건수를 센다.
  - 예전 `category=체험·교육` 주소를 처리한다.
  - 관심 분야의 «체험·교육»을 «체험»으로 읽는다(FeedSections).
- [X] T010 [US1] `frontend/src/components/ui/FilterBar.tsx`에 세부 칩 줄을 넣는다. 분야를 골랐을 때만 보이고, 건수가 0인 칩은 숨긴다.
- [X] T011 [US1] «대분류 · 세부» 꼬리표를 붙인다 (`Shelf.tsx`, `EventCard.tsx`, `app/events/[id]/page.tsx`, `MapSheet` 선반).

## Phase 4: US3 운영자 검토 (P2)

- [X] T012 [US3] `frontend/src/components/ui/AdminGenreControl.tsx`를 만든다. 상세에 두고 관리자에게만 보인다. 그 대분류의 세부만 고를 수 있고, 저장하면 `admin`으로 남는다.
- [X] T013 [US3] `frontend/src/components/admin/GenrePending.tsx`를 만들어 대시보드에 «세부 판정 대기 N건» 목록과 고르기 칸을 둔다.

## Phase 5: 검증·배포

- [X] T014 형 검사·빌드, 화면·필터 건수 확인 (quickstart 5·6·8)
- [ ] T015 015 커밋만 main에 올려 배포한다. 운영 화면을 확인하고 보고한다.
