---
description: "Task list for 내 주변 행사 (거리순 보기)"
---

# Tasks: 내 주변 행사 (거리순 보기)

**Input**: `specs/002-nearby-events/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 거리·정렬·필터·링크(순수 함수)와 장소 정규화·자동 확정 규칙에는 테스트를 둔다(헌장 V, quickstart 2). 화면은 내장 브라우저 미리보기로 확인한다.

**작업 방식**: 단계마다 커밋(공동 작성자 줄). 개발 서버는 사용자 승인 후 1개만(webpack, 힙 2GB). 마이그레이션 적용·`main` 병합(배포)은 사용자 승인 후.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 다른 파일이라 동시에 해도 되는 작업
- **[Story]**: US1(위치로 찾기) · US2(지역으로 찾기) · US3(좁히기)

---

## Phase 1: 확인 작업 (Setup)

**목적**: 계획의 미확인 3가지를 실제로 확인하고 research.md를 고친다. 결과에 따라 Phase 2 설계가 바뀔 수 있다.

- [x] T001 사용자에게 NAVER API HUB(네이버 클라우드 콘솔)에서 「지역 검색」 이용 신청·Application 등록·Client ID/Secret 확인을 안내(링크·누를 순서). 개발자센터에는 검색 API 신규 등록이 없다(2026-11-21 확인). 받은 값은 사용자가 `collector/.env`에 `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET`로 넣는다(값을 출력·커밋하지 않음)
- [x] T002 (KOPIS가 요청을 막아 미확인 — research §1에 기록, 네이버만으로 진행) [P] KOPIS `prfplc/{mt10id}` 응답 3건을 받아 위도·경도 칸 유무를 확인하고 research.md §1에 기록
- [x] T003 네이버 지역 검색 API로 표본 5곳(예: 해운대문화회관, 어댑터씨어터, 진주성)을 검색해 응답 좌표 형식·결과 수를 확인하고, 개발자센터의 일일 한도를 확인해 research.md §1에 기록(T001 뒤)
- [x] T004 [P] 네이버지도 앱 스킴(`nmap://route/public`, `nmap://route/car`)의 파라미터와 좌표 기반 웹 길찾기 주소 형식을 문서·실제 주소로 확인해 research.md §6과 contracts/naver-map-link.md를 확정
- [x] T005 공개 행사 `venue` 200개 표기를 정규화 규칙 초안으로 묶어 실제 장소 수를 세고 research.md §0에 숫자 기록(DB 읽기만)

**Checkpoint**: research.md에 「확인 필요」가 남아 있지 않다.

---

## Phase 2: 기반 (Foundational — 모든 이야기에 필요)

- [x] T006 `supabase/migrations/20261121000000_venues.sql` 작성: `venues` 표(data-model.md), `events.venue_id` FK, 공개 뷰 `public_venues(id,name,region,lat,lng)`(confirmed만), RLS(익명 select는 뷰만, 쓰기는 admin·service), 인덱스 `(name, region)` unique
- [x] T007 사용자 승인 후 마이그레이션 적용. 익명 키로 `public_venues` select 성공, `venues.candidates` select 거부를 확인(plan 단계 B)
- [x] T008 [P] `collector/venue_norm.py`: 이름 정규화(`\xa0`·괄호·관 이름 제거), 네이버 응답 → WGS84 변환, 자동 확정 판정(research §2), 부산·경남 경계 상자
- [x] T009 [P] `collector/tests/test_venue_norm.py`: 실제 표기 30개 정규화 기대값, 확정·보류 판정 사례(동명 카페, 경남 밖 결과, 후보 2개 300m 이내/밖)
- [x] T010 (키 없이 --dry-run까지 확인: 133곳·장소 없는 행사 15) `collector/tools/geocode_venues.py`: contracts/venue-geocode.md대로 `--backfill`·`--dry-run`·기본 모드, 보고 한 줄 출력(T008 뒤)
- [x] T011 (2026-11-21: 장소 119곳 · 자동 확정 94 · 확인 대기 22 · 실패 3, 공개 행사 692건 중 624건(90%) 거리 표시 — 자동 확정 목록을 이름·주소로 전수 확인, 오매칭 2건 규칙 수정) `--backfill --dry-run` 실행 결과 검토 → 실제 `--backfill` 실행. 확정 비율 ≥ 80% 확인(SC-001). 표본 30곳 오차를 네이버지도와 대조해 `docs/REPORT_nearby_geocode.md`에 표로 기록(SC-002)
- [x] T012 `collector/main.py` 정기 루틴 끝에 `geocode_venues` 기본 모드 호출, 완료 알림에 보고 한 줄 추가
- [x] T013 [P] `frontend/src/lib/nearby.ts`: 하버사인 거리, 거리 표기(`850m`·`1.2km`·`약`), 정렬(거리 → 날짜), 기간·거리·분야 필터, 좌표 없는 행사 분리
- [x] T014 [P] `frontend/src/lib/naverMap.ts`: contracts/naver-map-link.md의 4경우(T004 확정 형식)
- [x] T015 [P] `frontend/src/lib/__tests__/nearby.test.mjs`: 알려진 거리 ±1%, 정렬·필터 사례, 링크 4경우 문자열 고정. `node --test` 통과
- [x] T016 `frontend/src/app/nearby/page.tsx`: 서버에서 기간(최대 2주) 안 `PUBLISHED` 행사 + `public_venues` 좌표 조회(기존 `getPublishedEvents` 규칙: 숨김 분야 제외). 위치 관련 파라미터 없음

**Checkpoint**: 장소 좌표가 채워져 있고 순수 함수 테스트가 통과한다.

---

## Phase 3: User Story 1 — 지금 있는 곳에서 가까운 행사 (P1) 🎯 MVP

**Goal**: 위치를 허용하면 이번 주 행사가 가까운 순으로, 거리·날짜와 함께 나온다.
**Independent Test**: quickstart 3의 「허용」 경우.

- [x] T017 [US1] BRAND_GUIDE.md(5·12절 등 화면 규칙)를 읽고 목록 항목 디자인을 기존 `EventCard`·피드와 맞춤(날짜가 가장 큰 글자)
- [x] T018 [US1] `frontend/src/app/nearby/NearbyClient.tsx`: 「내 위치로 찾기」 버튼, 안내 한 줄, Geolocation 호출(timeout 6초, maximumAge 5분), 받는 중 표시, 정확도 1km 초과 시 「약」
- [x] T019 [US1] 같은 파일: 거리순 목록 렌더, 「거리 확인 안 됨」 묶음(시군 표시), 장소 없는 행사 제외, 결과 0건 안내와 「2주로 넓히기」 「거리 제한 풀기」, 50km 초과 시 「부산·경남 행사만 소개해요」
- [x] T020 [US1] 항목에 「대중교통 길찾기」 「자동차 길찾기」 버튼(`naverMap.ts`), 앱 미설치 시 1.5초 뒤 웹 전환
- [x] T021 [US1] `frontend/src/components/ui/FilterBar.tsx`(및 모바일 하단 내비)에 「내 주변」 진입 링크
- [x] T022 (2026-11-21 Vercel 미리보기 66a5216에서 확인: 광안리 좌표로 240m→910m→1.3km 거리순, 거리 표시 210·확인 안 됨 27, 요청 85건·저장소에 좌표 0건, 거부·6초 지연 문구 정상. 375px 폭은 미확인) [US1] 검증: `npx tsc --noEmit` 0, 내장 브라우저에서 geolocation 대체(광안리 좌표)로 거리 오름차순·「내 위치 기준」 확인, 네트워크 요청·URL에 좌표 0건(SC-005), 375px 가로 스크롤 없음, 스크린샷

**Checkpoint**: US1만으로 배포 가능한 MVP.

---

## Phase 4: User Story 2 — 위치 없이 지역으로 (P2)

**Goal**: 위치를 거부·실패해도 지역을 골라 그 중심 기준 거리순으로 본다.
**Independent Test**: quickstart 3의 「거부」 「7초 지연」 경우.

- [x] T023 [P] [US2] `frontend/src/lib/areaCenters.ts`: 경남 18 + 부산 16 기준점(시청·구청·군청). 좌표는 네이버 지역 검색으로 구하고 출처 주석(T003 키 필요)
- [x] T024 [US2] `NearbyClient.tsx`: 거부·실패·6초 초과 시 지역 고르기로 전환(오류 화면 없음), 「○○ 중심 기준」, localStorage `pica.nearby.area` 저장·복원(try/catch), `area` 쿼리 지원
- [x] T025 (미리보기 81f7c1b: 거부 → 지역 고르기 표시, 「부산 수영구」 → 「부산 수영구 중심 기준」 410m부터, 새로 열어도 유지) [US2] 검증: 거부 → 「부산 수영구」 선택 → 기준 문구·정렬 확인, 새로고침 후 선택 유지, 7초 지연 시 6초에 전환

---

## Phase 5: User Story 3 — 거리·기간·분야로 좁히기 (P3)

**Goal**: 3·10·30km, 오늘·주말·이번 주·2주, 분야로 목록을 좁힌다.
**Independent Test**: 「3km · 이번 주말」 선택 시 조건에 맞는 행사만 남고 개수가 보인다.

- [x] T026 [US3] `NearbyClient.tsx`: 필터 칩(URL 쿼리 `r`·`p`·`c` 동기화, 좌표는 URL에 넣지 않음), 남은 개수 표시
- [x] T027 [US3] 검증: 「3km」 「이번 주말」 조합으로 목록·개수 확인, URL 공유 시 같은 필터 복원

---

## Phase 6: 관리자 장소 확인 (FR-011)

- [x] T028 (코드·tsc·eslint 통과. 관리자 로그인으로 실제 저장은 T029에서 확인) `frontend/src/app/admin/venues/page.tsx`: `pending` 우선 목록(이름·별칭·시군·연결 행사 수·후보), 후보 고르기·좌표 붙여넣기·찾을 수 없음·두 장소 합치기, `checked_by`·`checked_at` 기록. 관리자 메뉴에 링크
- [ ] T029 검증: `pending` 장소 1곳을 확정하면 `/nearby`에서 그 행사에 거리가 생김(plan 단계 F)

---

## Phase 7: 마무리

- [x] T030 [P] `docs/`에 결과 보고(`docs/REPORT_nearby.md`): 확정 비율·오차 표본·화면 확인 결과·남은 문제
- [ ] T031 사용자 실기기 확인 요청: 아이폰·안드로이드에서 대중교통·자동차 길찾기 각 1회(quickstart 4)
- [x] T032 (2026-11-21 main f048180 → 운영 배포 성공, https://pick-art.vercel.app/nearby 200, 위치 허용 시 240m부터 거리순·210건 확인, 모바일 폭 가로 스크롤 없음) 사용자 승인 후 `main` 병합(배포) → 배포 주소에서 `/nearby` 확인

---

## Dependencies

- Phase 1 → Phase 2 → US1 → (US2, US3, 관리자 화면은 서로 독립) → 마무리
- T003·T023은 T001(키 발급) 뒤. T007은 사용자 승인 필요. T010은 T008 뒤, T011은 T007·T010 뒤
- T013·T014·T015는 DB와 무관해 Phase 1과 겹쳐 해도 된다

## Parallel 예

- Phase 2: T008+T009(수집기) ∥ T013+T014+T015(프런트 순수 함수)
- US2의 T023은 US1 화면 작업과 동시에 가능

## Implementation Strategy

1. Phase 1~2 → US1까지 끝내고 멈춰 확인(MVP). 이 시점에 배포할지 사용자에게 묻는다.
2. US2(위치 거부 대응)를 바로 이어 붙인다 — 위치 거부 비율이 높을 수 있어 실제 공개 전에는 US2까지 있는 편이 낫다.
3. US3·관리자 화면은 그다음.
