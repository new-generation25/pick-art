# Tasks: 확정 디자인(f01) 사이트 적용

**Input**: `specs/014-design-apply/` — [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md)

**Tests**: 명세가 TDD를 요구하지 않는다. 단, 판단 함수(`lib/posters.ts`)는 지금 lib 관례(`lib/__tests__/*.test.mjs`)대로 단위 시험을 붙인다. 나머지 확인은 quickstart.md 절차로 한다.

**Format**: `[ID] [P?] [Story] 설명 (파일 경로)`. 경로는 저장소 루트 기준이다. 단계마다 커밋한다(커밋 메시지 끝에 공동 작성자 줄).

---

## Phase 1: Setup

- [X] T001 시안과 지금 화면을 나란히 볼 수 있게 `.claude/launch.json`의 프론트 개발 서버 항목(webpack, `NODE_OPTIONS=--max-old-space-size=2048`)을 확인한다. 없으면 더한다. 개발 서버는 한 번에 하나만 띄운다 (`.claude/launch.json`)
- [X] T002 바꾸기 전 기준값을 기록한다. 운영 사이트 `https://picka.news`에서 quickstart 3단계의 주소 5개 묶음별 건수와 홈 FCP·LCP 3회를 재어 적는다 (`specs/014-design-apply/baseline.md`)

---

## Phase 2: Foundational (모든 이야기 전에)

**⚠️ 이 단계가 끝나야 사용자 이야기를 시작한다**

- [X] T003 마이그레이션을 만든다 (`supabase/migrations/20261127010000_design_apply.sql`). 머리에 되돌리기 SQL을 적고, 내용은 data-model.md를 그대로 따른다.
  - `placeholder_images`: `sha256 text PK`(64자리 소문자 16진수 CHECK), `bytes integer`, `note text`(≤120자), `marked_by uuid`, `marked_at timestamptz DEFAULT now()`. RLS는 읽기·쓰기 모두 `public.is_admin()`만.
  - `events`: `poster_sha256 text NULL`, `poster_placeholder boolean NOT NULL DEFAULT false`.
  - 트리거 두 개:
    - `events.poster_sha256`이 바뀌면 그 행의 `poster_placeholder`를 다시 계산한다.
    - `placeholder_images`에 행이 더해지거나 빠지면 같은 지문의 행사를 일괄로 고친다.
  - `orgs`·`venues`: `partner_since date NULL`(CHECK `partner_since <= (now() AT TIME ZONE 'Asia/Seoul')::date + 1`), `partner_note text NULL`(≤200자).
  - `public_venues` 뷰: `id, name, region, lat, lng, closed_days, capacity, district, partner_since` 순서로 다시 만든다.
- [X] T004 T003을 운영 DB에 적용하고 확인한다. 새 칸과 뷰 칸이 생겼는지, 익명 키로 `placeholder_images`를 읽으면 0행인지 본다. 결과를 `specs/014-design-apply/baseline.md`에 덧붙인다 (Supabase SQL)
- [X] T005 [P] (바꿈: 업로드 호출처가 9곳이라 각 저장 경로를 고치지 않고, `utils.process_and_upload_image`가 지문을 세 번째 값으로 돌려주게 하고 정기 루틴(`main.py`)에 `poster_fingerprint.py --apply` 단계를 더해 새 행사 지문을 채운다) 수집기가 포스터를 올릴 때 올린 바이트의 SHA-256을 `poster_sha256`으로 함께 넘기게 고친다 (`collector/database.py` 144행 부근, `collector/utils.py` 71행 부근, 행사 저장 경로)
- [X] T006 [P] 지문 채움 도구를 만든다 (`collector/tools/poster_fingerprint.py`).
  - 공개·검토 행사 중 `poster_sha256`이 빈 행의 포스터를 피카 저장소에서 받아 지문을 적는다.
  - `--apply`가 없으면 미리보기만 한다.
  - `--report`는 같은 지문을 3개 넘는 행사가 쓰는 그림 목록(«안내 그림 후보»)을 낸다.
  - 서비스 키는 출력하지 않는다.
- [X] T007 (결과 11/26: 지문 채움 472건, 바깥 주소(KOPIS 등) 413건은 받기 거절로 실패 — 브라우저처럼 꾸며 받는 방식은 쓰지 않았다. 후보 5개 중 포스터가 아닌 4개 표시(김해 «준비 중» 2종 각 9건, 통영 기본 회색 그림 21건, 함양문화예술회관 로고 카드 4건), 수요문화대학 시리즈 포스터는 실제 포스터라 두었다. 공개 행사 43건이 글자 포스터 대상) T006을 미리보기 → `--apply`로 돌린다. 처음 표시할 지문은 `239e6b7f…`(27,274바이트), `c5e19531…`(51,060바이트), k6 「제23회 김해시립소년소녀합창단 정기연주회」 포스터의 지문이다. 이 셋을 `placeholder_images`에 넣고 `poster_placeholder=true` 행사 수를 보고한다 (`collector/tools/poster_fingerprint.py --apply --mark`)
- [X] T008 공개 행사를 읽는 쿼리가 `poster_placeholder`를 함께 가져오게 한다 (`frontend/src/lib/supabase.ts`, `frontend/src/lib/places.ts`, `frontend/src/app/events/[id]/page.tsx`의 select)
- [X] T009 [P] 글자 포스터 판단 함수 `needsTextPoster({ poster_image_url, poster_placeholder })`와 출처 이름 함수 `posterSourceName(event)`를 만든다. 출처 이름은 장소 → 출처 순서로 고른다 (`frontend/src/lib/posters.ts`). 단위 시험을 붙인다 (`frontend/src/lib/__tests__/posters.test.mjs`)
- [X] T010 테마 묶음 `paper`를 더한다 (`frontend/src/app/globals.css`).
  - 값은 BRAND_GUIDE 2절 «화면 팔레트».
  - 분야 꼬리표 색은 공연·전시·축제·행사·체험 모두 흰 면에 테두리로 하고, 공연만 초록 글자로 한다(시안 f01).
  - `.pica-display`는 Gowun Batang 700에 그림자 없음.
  - `.pica-pin`·`.pica-origin`의 리소 기본값을 `paper` 색으로 바꾼다.
- [X] T011 글꼴을 바꾼다 (`frontend/src/app/layout.tsx`).
  - Gowun Batang(700)과 Space Grotesk(500·700)를 Google Fonts `display=swap`으로 더하고, Black Han Sans 링크는 뺀다.
  - `--pk-font-display`, `--pk-font-num` 변수를 `paper` 묶음에 둔다.
  - `viewport.themeColor`를 `#F4EFE6`으로 바꾼다.
- [X] T012 `MainLayout`의 `data-pica-theme`를 `"paper"`로 바꾼다 (`frontend/src/components/MainLayout.tsx`)
- [X] T013 포스터 또는 글자 포스터를 그리는 공용 컴포넌트를 만든다 (`frontend/src/components/ui/PosterOrText.tsx`).
  - `needsTextPoster`가 참이거나 이미지를 불러오지 못하면 글자 포스터를 그린다.
  - 글자 포스터 내용은 날짜(Space Grotesk, 가장 큼) · 제목 3줄 말줄임 · «정보: 출처 이름»이다. 포스터가 없는 행사면 «포스터 없음»을 작게 적는다.
  - 크기는 `size="shelf" | "detail" | "row"` 세 가지다.
- [X] T014 지금 `ImageWithFallback`·`EventCard`의 포스터 자리를 `PosterOrText`로 바꾼다 (`frontend/src/components/ui/EventCard.tsx`, `frontend/src/components/ui/ImageWithFallback.tsx`를 쓰는 곳)
- [X] T015 맨 위 줄을 pica 로고 · 찾기 · 내 정보(로그인 전이면 «로그인»)로 바꾼다. 관리자 링크, 인스타그램 링크, 로그아웃은 «내 정보» 메뉴 안으로 옮긴다 (`frontend/src/components/ui/Header.tsx`)
- [X] T016 확인한다: `npx tsc --noEmit`, quickstart 2단계(리소 색 검색), 9단계(명암비). 결과가 맞으면 커밋한다

**Checkpoint**: 모든 공개 화면이 새 색·글꼴로 보인다. 안내 그림을 쓰는 행사는 지금 카드 자리에서도 글자 포스터로 보인다.

---

## Phase 3: User Story 1 — 홈 날짜 묶음 선반 (P1) 🎯 MVP

**Goal**: 홈과 지역 페이지가 칩 줄 + 날짜 묶음별 좌우 선반 + 접힌 상시·장기로 보인다.

**Independent Test**: quickstart 3단계(묶음별 건수가 T002 기준과 같음)와 4단계(375×812 첫 화면).

- [X] T017 [P] [US1] 날짜 묶음 선반 컴포넌트를 만든다 (`frontend/src/components/ui/Shelf.tsx`).
  - 머리: 명조 묶음 이름 · 건수 · 정렬 기준 · «모두 보기» 링크(`?section=<key>`에 지금 필터 매개변수 유지).
  - 본문: 좌우로 넘기는 칸(scroll-snap). 첫 묶음은 칸 폭 104px, 나머지는 시안 폭이고, 묶음마다 앞 12장만 그린다.
  - 칸 내용: `PosterOrText` · 분야 꼬리표 · 날짜·시각(Space Grotesk) · 제목 2줄 · 장소 · 관람료(있을 때) · «피카가 본 이유»(있을 때).
- [X] T018 [US1] 필터 칩 줄을 기간⌄ · 지역⌄ · 분야⌄ · 아이와 + «필터»로 바꾸고, 화면 위에 붙게(sticky) 한다. 바꾸는 주소 매개변수(`date`·`region`·`category`·`kids`·`ended`·`q`)와 동작은 지금과 같다 (`frontend/src/components/ui/FilterBar.tsx`)
- [X] T019 [US1] 홈 머리말(큰 제목·설명)을 칩 줄로 바꾸고, 묶음을 `Shelf`로 그린다 (`frontend/src/components/HomeFeed.tsx`, `frontend/src/components/ui/FeedSections.tsx`).
  - `orderFeed()` 결과와 관심 분야를 앞으로 당기는 순서는 그대로 둔다.
  - 0건인 묶음은 숨긴다.
  - 결과가 0건이면 «조건에 맞는 행사가 없어요»와 필터를 푸는 버튼을 보인다.
- [X] T020 [US1] «상시·장기» 묶음을 접힌 한 줄 «상시·장기 N건 ⌄»로 두고, 누르면 펼친다 (`frontend/src/components/ui/FeedSections.tsx`)
- [X] T021 [US1] `?section=<key>`가 있으면 그 묶음만 세로 목록(지금 `EventList`의 20건씩 이어 그리기)으로 보인다 (`frontend/src/components/HomeFeed.tsx`, `frontend/src/components/ui/EventList.tsx`)
- [X] T022 [US1] 소식 받기(뉴스레터·키워드 알림) 띠를 `paper` 색의 옅은 띠로 바꾼다. `rgba(255,255,255,…)`와 `--pk-mark` 버튼을 없애고 폼 동작은 그대로 둔다 (`frontend/src/components/HomeFeed.tsx`)
- [X] T023 [US1] 확인한다: 개발 서버 375×812·1280에서 `/`, `/region/gimhae`를 본다. quickstart 3·4단계 결과를 `specs/014-design-apply/baseline.md`에 적는다. 맞으면 커밋한다

**Checkpoint**: 홈 단독으로 배포할 수 있는 상태다(MVP).

---

## Phase 4: User Story 2 — 안내 그림 → 글자 포스터 (P1)

**Goal**: 모든 자리에서 안내 그림이 글자 포스터로 보인다. 운영자가 표시하고 풀 수 있다.

**Independent Test**: quickstart 6단계.

- [X] T024 [US2] 관리자용 포스터 표시 버튼을 만들고 행사 상세(관리자에게만 보임)에 단다 (`frontend/src/components/ui/AdminPosterControl.tsx`).
  - 버튼은 «안내 그림으로 표시 / 풀기»다. 같은 지문을 쓰는 공개 행사 수를 함께 보인다.
  - 표시하면 `placeholder_images`에 넣거나 빼고, `note`는 ≤120자다.
  - 지문이 없는 행사는 버튼을 막고 «지문 없음(채움 도구 실행 필요)»을 적는다.
- [X] T025 [US2] 관리자 대시보드에 «안내 그림 후보» 상자를 더한다 (`frontend/src/app/admin/page.tsx`). 같은 지문을 3개 넘는 공개 행사가 쓰는 그림을 보여 주는데, 썸네일 · 행사 수 · 표시 버튼으로 구성한다
- [X] T026 [US2] 공유 미리보기(OG 이미지)는 `poster_placeholder`이면 기본 OG 이미지를 쓴다 (`frontend/src/app/events/[id]/page.tsx`의 `generateMetadata`)
- [ ] T027 [US2] 확인한다: quickstart 6단계(4개 행사 × 홈·상세·공간, 표시를 풀었다가 다시 표시). 맞으면 커밋한다

---

## Phase 5: User Story 3 — 지도 시트 (P2)

**Goal**: 홈의 «지도» 버튼으로 시트가 열리고, 그때만 지도를 불러온다.

**Independent Test**: quickstart 5단계.

- [X] T028 [US3] 지도 시트를 만든다 (`frontend/src/components/ui/MapSheet.tsx`).
  - 아래에서 올라와 화면을 덮고, 뒤 화면은 어둡게 한다.
  - 머리: 켠 필터 요약 · «N건 · 장소 N곳» · 내리기.
  - 지도는 `next/dynamic`으로 `app/nearby/NearbyMap.tsx`를 불러온다.
  - 핀을 누르면 그 장소 행사의 작은 선반과 «공간 정보 ›»가 나온다. 그 아래는 장소 목록(위치를 허락하면 가까운 순, 아니면 행사 수 순)이고, 맨 아래가 «위치 정보 없음»이다.
  - 닫는 방법: 내리기, «목록», 뒤로 가기(history state), 바깥 누르기.
- [X] T029 [US3] 홈에 «지도» 버튼을 화면 아래 가운데에 띄운다. 시트에는 지금 필터 결과의 행사·장소를 넘긴다(장소 묶기는 `lib/mapGroups.ts` 재사용) (`frontend/src/components/HomeFeed.tsx`)
- [X] T030 [US3] 지도를 불러오지 못하면 지도 자리에 «지도를 불러오지 못했어요»를 띄우고, 장소 목록은 그대로 둔다 (`frontend/src/components/ui/MapSheet.tsx`)
- [X] T031 [US3] `/nearby`는 지금 화면을 유지하고 새 색만 입었는지 확인한다 (`frontend/src/app/nearby/NearbyClient.tsx`)
- [X] T032 [US3] 확인한다: quickstart 5단계(누르기 전 지도 요청 0건, 누른 뒤 숫자 일치). 맞으면 커밋한다

---

## Phase 6: User Story 4 — 상세 (P2)

**Goal**: 상세가 시안 순서로 보이고, 지금 칸이 하나도 빠지지 않는다.

**Independent Test**: quickstart 7단계의 상세 항목. 칸이 많은 행사(어린이 서커스 쇼)와 칸이 적은 행사를 함께 본다.

- [X] T033 [P] [US4] 상세 아래 고정 막대를 만든다: 찜 · 공유 · «원본 안내 페이지 열기». 원본 주소가 없으면 «단체 제공 — 원본 안내 없음»을 보인다. 지금 `outbound` 세기도 유지한다 (`frontend/src/components/ui/StickyActions.tsx`)
- [X] T034 [US4] 상세를 시안 순서로 다시 짠다 (`frontend/src/app/events/[id]/page.tsx`).
  - 순서: 포스터 띠(`#EBE4D7`, `PosterOrText size="detail"`, 누르면 `PosterViewer`) → 겹친 요약 카드 → «길찾기»(`RouteButtons`/`VenueRoute`)·«공간 정보» → 정보 줄(시각·관람료·관람·공간·출처·확인한 날·주최·주관·단체 제공) → «피카가 본 이유» 초록 테두리 → 안내 문구와 «피카가 고르는 기준» 링크 → 상세 안내(지금 조건, 휴대전화 가림 유지) → 같은 주 같은 지역 행사 → 오류 신고·캘린더 추가.
  - 작은 지도는 넣지 않는다.
- [X] T035 [US4] 관리자 컨트롤(`AdminNoteControl`·`AdminKidsControl`·`AdminInstaMark`·`AdminPosterControl`)은 관리자에게만 보이고, 새 배치에서도 그대로 작동하는지 확인한다 (`frontend/src/app/events/[id]/page.tsx`)
- [X] T036 [US4] 확인한다: 행사 3건(칸 많음 · 칸 적음 · 단체 제공)의 상세에서 contracts/screens.md 상세 표의 항목을 ✓/✗로 적는다. ✗가 0이면 커밋한다

---

## Phase 7: User Story 5 — 공간·단체와 협약 (P3)

**Goal**: 공간·단체 페이지가 새 구성으로 보이고, 운영자가 표시한 곳에만 협약 배지가 보인다.

**Independent Test**: quickstart 8단계.

- [X] T037 [US5] 공간·단체 데이터에 `partner_since`를 더한다. 공간의 «이곳 행사를 여는 곳»(`event_orgs` → 기관·단체, 맡은 일, 건수, 협약 여부)을 계산한다 (`frontend/src/lib/places.ts`, `frontend/src/app/venues/[id]/page.tsx`, `frontend/src/app/orgs/[id]/page.tsx`)
- [X] T038 [US5] `PlacePage`를 시안 구성으로 다시 짠다 (`frontend/src/components/PlacePage.tsx`).
  - 순서: 머리 띠(«공간 · 지역», 협약 배지, 명조 이름, 객석, 다가오는 행사 수, 휴관일) → «길찾기»(공간만)·«일정 캘린더로 받기» → 다가오는 행사 `Shelf` → 상시 한 줄씩 → 이곳 행사를 여는 곳(기관=건물 아이콘, 단체=사람 아이콘, 협약=초록 도장, 맡은 일·건수, 범례) → 지난 행사 최근 1년 → 안내 문구.
  - 작은 지도는 넣지 않는다.
- [X] T039 [US5] (바꿈: 관리자 장소 목록 대신 공간 페이지 머리에 관리자만 보이는 «협약 맺음/풀기»를 단다 — T040과 같은 `AdminPartnerControl`) 관리자 장소 화면에 «협약 맺음(날짜) / 풀기»를 더한다. 풀면 `partner_since`를 비우고 `partner_note`에 「YYYY-MM-DD 해지」를 덧붙인다(≤200자) (`frontend/src/app/admin/venues/`)
- [X] T040 [US5] 단체 페이지에 관리자에게만 보이는 «협약 맺음 / 풀기» 컨트롤을 단다. 규칙은 T039와 같다 (`frontend/src/components/ui/AdminPartnerControl.tsx`, `frontend/src/app/orgs/[id]/page.tsx`)
- [X] T041 [US5] 확인한다: quickstart 8단계(시험 공간에 넣었다 풀기). 시험 값은 원래대로 되돌리고, 배포 직후 배지가 0곳인지 확인한다. 맞으면 커밋한다

---

## Phase 8: User Story 6 — 내 정보 (P3)

**Goal**: `/me` 한 화면에서 찜·지역·관심 분야·캘린더·알림·계정을 다룬다. 예전 주소는 깨지지 않는다.

**Independent Test**: spec US6 Independent Test(찜 보기 → 지역 → 관심 분야 → 캘린더 → 알림 → 로그아웃, 다시 열어 값 유지).

- [X] T042 [US6] `/me` 화면을 만든다 (`frontend/src/app/me/page.tsx`).
  - 순서: 프로필(닉네임·계정·«고치기») → 찜한 행사 `#saved`(`favorites` 선반 + «모두 보기») → 내 지역·«내 지역 먼저 보기» → 관심 분야 칩 → 캘린더로 받기(구글·애플, `/calendar.ics`) → 알림 `#settings`(새 행사·이메일) → 단체·공간 안내(`/partners`) → 피카가 고르는 기준(`/about`) → 계정 정보·약관·개인정보·로그아웃.
  - 저장은 지금 `app/settings/page.tsx`와 같은 `profiles` 칸에 한다.
  - 로그인 전이면 로그인 안내를 보인다.
- [X] T043 [US6] `/saved`는 `/me#saved`로, `/settings`는 `/me#settings`로 서버 리디렉트한다. `/calendar`는 그대로 두고 새 색만 입었는지 확인한다 (`frontend/src/app/saved/page.tsx`, `frontend/src/app/settings/page.tsx`, `frontend/src/app/calendar/page.tsx`)
- [X] T044 [US6] (부분: 예전 주소 3개와 로그인 전 화면은 확인. 로그인한 화면은 미리보기 브라우저에 로그인이 없어 확인하지 못함 — 운영자 확인 필요) 확인한다: 로그인 계정으로 US6 시험을 하고, 예전 주소 3개를 연다. 맞으면 커밋한다

---

## Phase 9: Polish & 전체 검증

- [ ] T045 [P] 나머지 공개 화면(`/about`, `/partners`, `/tip`, `/login`, `/signup`, `/welcome`, `/privacy`, `/terms`, `not-found`, `error`)에서 리소 색과 읽기 어려운 곳이 있는지 375px로 훑어 고친다 (`frontend/src/app/*`)
- [ ] T046 [P] 관리자 화면이 새 색·글꼴 때문에 읽기 어려워진 곳이 없는지 확인한다. 관리자 화면은 `.pica-public` 밖이라 영향이 없어야 한다 (`frontend/src/app/admin/*`)
- [ ] T047 [P] 한눈에 보기 페이지에 화면 팔레트를 더한다 (`docs/brand/brand-guide.html`)
- [ ] T048 quickstart 1~10단계를 전부 돌리고, 결과(숫자·스크린숏 경로)를 적는다 (`specs/014-design-apply/verification.md`)
- [ ] T049 `/speckit-converge`로 명세 대비 빠진 일을 찾고, 남은 것을 처리한다
- [ ] T050 운영자에게 결과 보고 아티팩트와 배포 승인 요청을 보낸다. `main` 합치기는 승인 뒤에 한다

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → (US1, US2, US3, US4, US5, US6) → Phase 9**
- **Phase 2 안**: T003 → T004 → T007이 이어진다. T005·T006·T009는 서로 병렬이다. T010 → T011 → T012가 이어지고, T013은 T009 뒤, T014는 T013 뒤다.
- **US1**: Phase 2 뒤. T017 → T019 → T020·T021·T022 → T023.
- **US2**: Phase 2(T007·T013) 뒤. US1과 병렬로 할 수 있지만, 확인(T027)은 US1 홈 선반이 있어야 완전하다.
- **US3**: US1의 홈 구조(T019) 뒤.
- **US4**: Phase 2 뒤. US1과 병렬(다른 파일).
- **US5**: Phase 2와 `Shelf`(T017) 뒤.
- **US6**: Phase 2와 `Shelf`(T017) 뒤.

### 병렬 예시

```text
Phase 2: T005(수집기 업로드 지문) ∥ T006(채움 도구) ∥ T009(lib/posters.ts)
US1 시작 뒤: T017(Shelf) ∥ T033(StickyActions, US4)
US5·US6: T039(관리자 장소) ∥ T042(/me) — 서로 다른 파일
```

## Implementation Strategy

- **MVP**: Phase 1·2 + US1(홈 선반). 이것만으로 새 색·글꼴·글자 포스터(카드 자리)·홈 구성이 보인다.
- **다음 묶음**: US2(관리자 표시) → US4(상세) → US3(지도 시트) → US5 → US6.
- **배포**: 이야기마다 로컬에서 검증하고 커밋한다. `main` 합치기는 전체 검증(T048) 뒤 운영자 승인으로 한 번에 한다(T050). 운영자가 원하면 MVP만 먼저 올릴 수 있다.
