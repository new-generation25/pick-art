# 019 작업 목록 — 관리자 화면 개편

명세 [spec.md](spec.md) · 계획 [plan.md](plan.md). 운영자 11/27 «추천대로 시작»(선택 5개 모두 추천안, 순서 A0 → A6).
단계마다 로컬 빌드·화면 확인 → 운영자 «배포해» → 운영 주소 확인.

## A0 걷어내기 (US2 · FR-001~004, SC-001·008)

- [X] T001 쓰지 않는 화면 3곳 삭제: `frontend/src/app/admin/subscribers`·`configs`·`ai-prompt`
- [X] T002 쓰는 곳이 없는 API 4개 삭제: `frontend/src/app/api/newsletter`·`keywords`·`getPrompt`·`collector/status`
- [X] T003 예전 주소 3개를 `/admin`으로 보내기: `frontend/next.config.ts` redirects
- [X] T004 메뉴에서 «구독자 관리»·«시스템 설정» 빼기: `frontend/src/components/ui/AdminHeader.tsx`
- [X] T005 인박스: «설정»·«리포트» 버튼과 «예약 발행» 칸 삭제(늘 바로 공개), 탭 이름 «인박스(COLLECTED)» → «자동 공개 대기», «픽아트» → «피카»: `frontend/src/app/admin/inbox/page.tsx`
- [X] T006 출처 화면 다시 쓰기: «실행»·«중지»·«Collector ON/OFF»·크롤링 로그·blocked 탭·«AI 프롬프트 설정» 삭제, 종류별 묶음(웹·블로그·인스타), 출처마다 마지막 정기 실행 결과, 지우기는 화면 안 확인 창: `frontend/src/app/admin/sources/page.tsx`
- [X] T007 맨 위 줄을 두 번 그리던 화면 4곳(인박스·직접등록·저장공간·장소 좌표)에서 화면 쪽 `AdminHeader` 삭제, 위 여백 맞춤
- [X] T008 리플렛 «반영 안 함» 메모 칸(메모가 늘 빈 값으로 저장되던 것): `frontend/src/app/admin/leaflets/page.tsx`
- [X] T009 단체 협약 메모를 관리자만 읽는 표로: `supabase/migrations/20261127100000_org_admin_notes.sql`(운영 DB 적용 11/27, 익명 읽기·쓰기 401 확인), `frontend/src/lib/orgNotes.ts`, 협약 화면·협약 표시 버튼이 새 표에 씀. 협약을 풀 때 «맺은 날~푼 날»을 남김
- [X] T010 배포 뒤 옛 칸 지우기 적용(11/27) → 익명 키로 `orgs.partner_note` 읽기 400 «column does not exist», 공개 단체 화면 200 (SC-008)
- [X] T011 로컬 빌드 확인(11/27): 삭제한 주소 3개가 `/admin`으로 감, 남은 관리자 화면 13곳이 모두 그려짐, 없앤 버튼 6개가 화면에 없음. 남은 버튼을 하나씩 눌러 보는 확인은 하지 않았다(운영자 화면 검토 때 함께)
- [X] T012 운영 배포(main 1f94621, 11/27): `/admin`·`/admin/status`·`/admin/refine` 200, 없앤 화면 3곳 307 → `/admin`, 없앤 API 404, 로그인 화면 종이 테마, 홈 칩 줄 구조 반영

남긴 것(쓰지 않지만 지우지 않음): DB 표 `subscribers`·`keywords`·`configs`·`crawler_configs`·`blacklist`·`crawl_logs`와 함수 `subscribe_newsletter`·`add_keyword_alerts`, `frontend/src/lib/localOnly.ts`(헌장 III이 가리킴), 수집기의 수동 요청 처리(`collector/main.py check_manual_requests`).

## A1 틀 (US3 · FR-005~010)

- [X] T020 관리자 틀 `frontend/src/components/admin/AdminShell.tsx`: 메뉴 5곳(오늘 할 일·대기함·행사·출처·단체·현황), 휴대폰은 아래 탭, PC는 위 줄. 지금 화면들을 다섯 메뉴 아래 둘째 줄 칩으로 묶음. 옛 `AdminHeader.tsx` 삭제
- [X] T021 관리자 확인이 끝난 뒤에만 화면을 그리기(확인 전 «관리자 확인 중…», 로그인 전이면 `/login?next=/admin`, 관리자가 아니면 홈): `AdminShell` + `frontend/src/app/admin/layout.tsx`
- [X] T022 메뉴 숫자: 대기함 = 받은 것(리플렛·신고·제보·협약), 현황 = 켜진 경고 수: `frontend/src/lib/adminCounts.ts`
- [X] T023 종이 테마 색·글꼴: 틀은 테마 변수, Mantine 단추의 남색·파랑은 `globals.css`의 `:root:has(.pica-admin)`에서 짙은 초록으로. 화면별 회색 바탕 제거
- [X] T024 지역(경남 18 시군+부산)·분야 목록을 `lib/regions`·`lib/categories`에서 읽기: 인박스 편집 창·새 행사
- [X] T025 로컬 빌드, 폭 375px 틀 안에서 관리자 화면 13곳 모두 가로 넘침 0(처음엔 공개 판단 322px·장소 70px·저장공간 69px 넘쳐서 고침). 로그인하지 않은 브라우저로 `/admin` → 관리자 내용 없이 로그인 화면으로 감. 관리자가 아닌 회원 계정으로는 확인하지 못함(시험 계정 없음)

## A2 오늘 할 일 (US1 · FR-011·012)

- [X] T030 첫 화면을 사람 몫 목록으로: `frontend/src/app/admin/page.tsx` — 정기 실행 한 줄(마지막 실행·실패·경고·다음 회차) + 종류별 건수·가장 오래된 날, 0건은 «없음» 한 줄로 접음
- [X] T031 예전 대시보드는 `frontend/src/app/admin/status/page.tsx`(현황)로 옮김. 세부 갈래·안내 그림은 `frontend/src/app/admin/refine/page.tsx`(대기함)로
- [X] T032 대조(11/27 13:19): 공개 후보 74·사람 판단 187·동의 필요 359(합 620 = 08:20 회차 «남은 REVIEW 620»), 자동 공개 대기 77(DB COLLECTED 77), 장소 확인 2(DB pending 2), 리플렛·신고·협약 0(DB 0), 세부 갈래 101(진행 중 행사만, 세부 판정 화면과 같은 조건)

## A3 대기함 (US4 · FR-013~017)

- [X] T040 `frontend/src/app/admin/inbox/page.tsx` 다시 쓰기: 갈래 6개(공개 후보·사람 판단·동의 필요·자동 공개 대기·최근 결과·반영 안 한 것). «발행하기»(검증 없이 바로 공개)·«현재 노출 삭제»·«휴지통 비우기»를 없앰 — 승인·고친 것은 다음 정기 실행이 검증한 뒤 공개하고, 반영 안 한 것은 지우지 않아 다시 수집되지 않는다
- [X] T041 `inbox/CollectedQueue.tsx`: 자동 공개에서 빠진 것을 이유별로(날짜 없음 · 검증에서 멈춤 · 60일 뒤는 접어 둠). 날짜를 적어 저장하면 다음 실행이 검증
- [X] T042 `inbox/ConsentGroups.tsx`: 동의 필요를 계정별 묶음으로(359건 → 계정 128곳), 계정의 동의 단계(없음·임시·상시·철회)와 근거를 그 자리에서 저장
- [X] T043 `inbox/ReviewQueue.tsx`: 원문 보기(근거), 승인·옮긴 사람 기록, 20건씩 더 보기
- [X] T044 «최근 결과»: 승인한 것이 공개됐는지·검증에 걸렸는지(이유)·대기 중인지
- [X] T045 제보 → «행사로 등록»: 제보에 적힌 제목·날짜·장소·주소를 채운 새 행사 양식으로 열고, 저장하면 제보를 «반영함»으로 닫음 (`admin/reports/page.tsx`)
- [X] T046 로컬 확인(11/27): 갈래별 건수 74·187·359·77·272, «반영 안 함» → «반영 안 한 것»에 보임 → «되돌리기»로 원래 자리(77 → 76 → 77). 승인 → 다음 회차 결과 확인은 운영자가 실제 후보를 승인해야 볼 수 있다(specs/003 R2 ④)

## A4 행사 (US5 · FR-018~021)

- [X] T050 공통 행사 칸 `frontend/src/components/admin/EventFields.tsx`(제목·분야·세부·지역·장소·시작일·끝나는 날·관람료·무료·원본 주소·상세). 새 행사·고치기·리플렛 등록이 같이 씀 → 행사 넣는 양식 3개 → 1개 (SC-006)
- [X] T051 `frontend/src/app/admin/events/page.tsx`: 공개·숨김, 제목·장소·출처 찾기, 지역·분야·기간 거르기, 50건씩(1,000건 한계 없음), 고치기 창, 숨김(이유)·되돌리기
- [X] T052 `frontend/src/app/admin/events/new/page.tsx`: 새 행사(원본 안내 주소 필수). 옛 `/admin/manual`은 이 주소로 보냄
- [X] T053 DB `events.hidden_reason·hidden_by·hidden_at·keep_visible·edited_at`(운영 적용). 숨김 76건 모두에 이유를 백업 파일 7개에서 찾아 적음 (SC-007)
- [X] T054 수집기: `dedupe_published.py`가 숨길 때 이유를 남기고 `keep_visible` 행은 다시 숨기지 않음, `hide_events.py`도 이유를 남김
- [X] T055 로컬 확인(11/27): 진행 중·예정 698건/끝난 것 424건 조회, 끝난 행사 1건(엘콰이어 정기연주회)을 고치기 저장 → 숨김(424 → 423) → 숨김 목록에 이유 «같은 행사가 따로 있음(중복) · 운영자» → 되돌리기(77 → 76). 그 행사는 `keep_visible=true`로 남았다

## A5 출처·단체 (US6 · FR-022~025)

- [X] T060 DB `whitelist.consent·consent_at·consent_evidence·paused_reason`(운영 적용), 글자 표시 19곳을 칸으로 옮겨 적음(임시 18 · 상시 1 — 옮기기 전 표와 같음). `role·score·score_detail`은 마이그레이션 기록을 맞춤
- [X] T061 `frontend/src/app/admin/sources/page.tsx`: «살펴볼 것»(실패·정의 만료 의심·0건 2회 연속·켜진 경고), 동의 단계 표시·고치기, 쉬게 함(이유)
- [X] T062 수집기: `triage_review.py`가 동의 칸을 읽음(칸이 «없음»이면 예전 글자 표시), `main.py`가 쉬게 한 웹·블로그 출처를 건너뛰고 «⏸️ 일시 중지: 이유»로 보고
- [X] T063 `frontend/src/app/admin/orgs/page.tsx`: 단체 338곳 찾기, 종류·인스타 계정·협약 맺은 날 고치기, 관리자 메모
- [X] T064 `frontend/src/app/admin/venues/page.tsx`: 확정 장소의 휴관일·객석·구·군 고치기, 행사 수를 끝까지 읽기
- [ ] T065 다음 정기 실행에서 확인: 쉬게 한 출처가 건너뛰어지는지 — **확인(11/27 15:00 회차: 쉬게 한 출처 7곳을 «⏸️ 일시 중지: 이유»로 건너뜀)**. 동의 단계를 바꾼 계정의 글이 정리에서 옮겨지는지 — 남음(운영자가 실제로 바꿨을 때)

## A6 현황 (US7 · FR-026~028)

- [X] T070 수집기 `ops_log.record_steps` + `main.py`: 회차마다 단계별 한 줄을 `ops_snapshots.routine_steps`에(최근 14회). 11/27 08:20 회차는 로그에서 옮겨 넣음
- [X] T071 `frontend/src/components/admin/OpsExtras.tsx`: 회차 요약, 휴대폰 알림(기기 1 · 주말 요약 1통), 회원(2명 · 찜 2 · 장소 찜 0) — 관리자만 부르는 집계 함수 `admin_push_stats`·`admin_member_stats`(익명 401)
- [x] T072 11/27 15:00 회차가 스스로 남긴 회차 요약이 로그와 같은지 확인 (SC-009) — routine_steps 맨 위 회차 15:00, 단계 14줄 모두 `collector/logs/scheduled_20261127_1500.log` 요약 줄에 있음. 같은 회차의 공개 후 중복 숨김 1건에 이유·처리자 기록됨, 이유 없는 숨김 0건
- [x] T073 A3~A6 운영 배포(main 0a274ec, 11/27 17시, 운영자 «배포해») — Vercel pick-art 성공, 운영 주소 관리자 10곳 200, `/admin/manual` 307 → `/admin/events/new`

## A7 대기함 자세히 보기·코멘트·판단 기준 (FR-029~031, 2026-11-27 운영자 추가)

- [X] T080 `frontend/src/app/admin/inbox/PostDetail.tsx`: 글 자세히 보기 창(포스터·수집한 글·원문 열기·대기 이유), `waitingReason`이 상태·갈래·분류 이유를 운영자 말로 풂
- [X] T081 `frontend/src/app/admin/inbox/notes.ts` + 창의 코멘트 칸: `raw_posts.content.admin_notes`(최근 20개, 500자)에 쓰고 지움. 쓰기 직전에 최신 content 를 다시 읽고 상태가 같을 때만 저장
- [X] T082 `ReviewQueue.tsx`·`ConsentGroups.tsx`·`CollectedQueue.tsx`·`page.tsx`: 여섯 탭의 줄 어디를 눌러도 창이 열림(링크·버튼·입력칸 제외), 코멘트 수 표시. 카드의 «원문 보기»(펼침)는 창으로 옮기고 링크 이름은 «원문 열기»로
- [X] T083 `frontend/src/app/admin/inbox/Criteria.tsx`: «판단 기준 한눈에 보기» 창
- [X] T084 `collector/tools/review_notes.py` + 시험: 코멘트 모아 읽기(읽기 전용)
- [X] T085 로컬 확인(11/27, 운영 빌드 + MAX Chrome): 사람 판단 글에서 창 열림·대기 이유 «날짜를 읽지 못했습니다» 표시, 코멘트 쓰기 → 카드에 «운영자 코멘트 1개» → 지우기, 판단 기준 창, 375px 틀에서 자동 공개 대기·반영 안 한 것·동의 필요 줄을 눌러 창 열림(창 폭 338px, 가로 넘침 0). 캡처 `docs/plan/admin_inbox_detail_2026-11-27.jpg`
- [X] T086 운영 배포(main cff6c9f, 11/27 저녁, 운영자 «배포해») — A7·A8 함께. Vercel pick-art 성공. 운영 주소(MAX Chrome 관리자 로그인)에서 «동의 필요» 정렬 버튼 4개·단계별 계정 수, «판단 기준 한눈에 보기» 버튼, 공개 후보 글을 눌러 자세히 보기 창(대기 이유·코멘트 칸) 확인. 홈·내 주변·협약 페이지 200

## A8 확정 동의 표시·정렬 (FR-032, 2026-11-27 운영자 추가)

- [X] T087 `frontend/src/lib/siteConsent.ts`: 사이트 동의 읽기(`partner_agreements` new·confirmed, 인스타 계정 기준), 정렬 순위
- [X] T088 `admin/inbox/ConsentGroups.tsx`: «확정 동의»·«사이트 신청 · 확인 전» 표시, 단계별 계정 수 한 줄, 정렬 버튼 4개(기본 «동의 받은 계정 먼저»)
- [X] T089 `admin/sources/page.tsx`: 같은 표시 + «동의 받은 계정 먼저» 버튼

## A9 회원 목록 (FR-033, 2026-11-27 운영자 요청)

- [X] T093 `frontend/src/app/admin/members/page.tsx` + 현황 메뉴 «회원»: 별명으로 찾기, 역할 거르기, 50명씩. `OpsExtras.tsx` 회원 칸에 목록 링크
- [X] T094 로컬 확인(11/27): 3명(관리자 2 · 일반 1), 역할 거르기 2명/1명, 화면에 이메일·전화번호 모양의 글자 없음, 375px 가로 넘침 0
- [X] T095 운영 배포(main ce0a37f, 11/27, 운영자 «배포해») — Vercel pick-art 성공, 운영 주소 `/admin/members`에서 3명 표시·현황 메뉴에 «회원»·이메일 모양 글자 없음·가로 넘침 0 확인

## 11/27 원문 확인에서 나온 것

- [X] T090 공개 후보 74건의 인스타그램 원문을 브라우저에서 읽음: 72건 열림, 2건 «Post을(를) 이용할 수 없습니다» → 2건을 «반영 안 함»(이유 기록, 되돌릴 수 있음)으로 옮김. 공개 후보 72건
- [ ] T091 정기 실행의 링크 확인(`collector/utils.py check_link`)은 인스타그램 글이 지워졌는지 가려내지 못한다(지워진 글도 HTTP 200). 가려낼 방법은 인스타 수집과 같은 브라우저 세션으로 글을 여는 것 — 「인스타 수집」 세션 몫
