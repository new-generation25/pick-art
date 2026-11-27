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
- [ ] T010 배포 뒤 `supabase/migrations/20261127110000_orgs_drop_partner_note.sql` 적용(옛 칸 지우기) → 익명 키로 `orgs.partner_note` 읽기가 거절되는지 확인 (SC-008)
- [X] T011 로컬 빌드 확인(11/27): 삭제한 주소 3개가 `/admin`으로 감, 남은 관리자 화면 13곳이 모두 그려짐, 없앤 버튼 6개가 화면에 없음. 남은 버튼을 하나씩 눌러 보는 확인은 하지 않았다(운영자 화면 검토 때 함께)
- [ ] T012 운영자 «배포해» 뒤 운영 주소 확인 (A0·A1·A2 함께)

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

## A3~A6

단계 시작 때 채운다(plan.md의 단계 표).
