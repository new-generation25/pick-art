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
- [ ] T011 로컬 빌드에서 관리자 화면 8곳의 버튼을 눌러 «동작 없음» 0 확인, 삭제한 주소 3개가 `/admin`으로 가는지 확인 (SC-001)
- [ ] T012 운영자 «배포해» 뒤 운영 주소 확인

남긴 것(쓰지 않지만 지우지 않음): DB 표 `subscribers`·`keywords`·`configs`·`crawler_configs`·`blacklist`·`crawl_logs`와 함수 `subscribe_newsletter`·`add_keyword_alerts`, `frontend/src/lib/localOnly.ts`(헌장 III이 가리킴), 수집기의 수동 요청 처리(`collector/main.py check_manual_requests`).

## A1 틀 (US3 · FR-005~010)

- [ ] T020 관리자 틀 `frontend/src/components/admin/AdminShell.tsx`: 메뉴 5곳(오늘 할 일·대기함·행사·출처·단체·현황), 휴대폰은 아래 탭, PC는 위 줄. 지금 화면 10곳을 다섯 메뉴 아래 둘째 줄로 묶음
- [ ] T021 관리자 확인이 끝난 뒤에만 화면을 그리기(확인 전에는 «확인 중», 관리자가 아니면 홈으로): `frontend/src/app/admin/layout.tsx`
- [ ] T022 메뉴의 대기 건수 숫자: `frontend/src/lib/adminCounts.ts`
- [ ] T023 종이 테마 색·글꼴을 관리자 틀에 적용
- [ ] T024 지역·분야 목록을 `lib/regions`·`lib/categories`에서 읽기: 인박스·직접등록
- [ ] T025 폭 375px에서 관리자 화면 가로 스크롤 0 확인, 비관리자 접근 확인

## A2 오늘 할 일 (US1 · FR-011·012)

- [ ] T030 첫 화면을 사람 몫 목록으로: `frontend/src/app/admin/page.tsx` — 정기 실행 한 줄 + 종류별 건수·가장 오래된 날
- [ ] T031 지금 대시보드 내용은 `frontend/src/app/admin/status/page.tsx`(현황)로 옮김
- [ ] T032 건수를 운영 DB를 직접 센 값과 대조 (SC-004)

## A3~A6

단계 시작 때 채운다(plan.md의 단계 표).
