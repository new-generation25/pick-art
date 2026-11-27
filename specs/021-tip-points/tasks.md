# 021 작업 목록 — 숨은 행사 찾기: 로그인 제보와 활동 포인트

명세 [spec.md](spec.md) · 계획 [plan.md](plan.md). 로컬 확인 → 운영자 «배포해» → 운영 DB 적용·배포·운영 주소 확인.

## 1. 바탕 (DB)

- [X] T001 `supabase/migrations/20261127140000_points.sql`: 표 `point_ledger`(`amount` 0 아님, `reason IN ('tip')`, `(reason, ref_table, ref_id)` 고유), RLS(본인·관리자 읽기만)
- [X] T002 같은 파일: 적립 트리거(`reports` done ↔ +100/삭제, `leaflet_submissions` kakao_bot published ↔ +100/삭제), `my_points()`, `admin_member_points()`
- [X] T003 같은 파일: `submit_tip` 로그인 필수(`login_required`), `tip_upload_allowed`·`tip_photo_failed` 본인만, 저장소 정책 authenticated 만, anon 실행 권한 회수
- [X] T004 운영 DB 되돌림 시험(11/27, `checks/make_dryrun.py` → `checks/dryrun.sql`, 남는 변경 없음 — 뒤에 `point_ledger` 없음 확인): 26개 항목 모두 통과. 로그인 없는 접수 거절(`login_required`, 익명 역할은 실행 권한 없음), 회원 접수, 반영함 → +100, 다시 저장해도 한 번, 반영 안 함 → 0, 다시 반영함 → 한 번, `my_points()` = 100·1위, 관리자가 아닌 다른 회원은 내역 0줄·사진 올리기 불가·`admin_member_points()` 0줄, 회원 직접 넣기 막힘, 로그인 없이 온 예전 제보는 반영해도 포인트 없음, 회원이 이어진 카카오 제보 published → +100, 리플렛(web)은 대상 아님

## 2. US1 — 로그인 제보 (P1)

- [X] T010 [US1] `frontend/src/lib/reports.ts`: `TIP_EVENT_NAME`, `TIP_POINTS`, `COUPON_UNTIL`·`couponOpen()`, `COUPON_NOTE`, `POINTS_NOTE`, `login_required` 오류 문구
- [X] T011 [US1] `frontend/src/app/tip/TipForm.tsx`: 로그인 전 안내 + «로그인하고 제보하기», 보낸 뒤 «실리면 100포인트», «내가 보낸 제보», 쿠폰 칸은 12월까지
- [X] T012 [US1] `frontend/src/app/tip/page.tsx`: 제목 «숨은 행사 찾기», 안내 문구, 한 시간마다 다시 그리기(쿠폰 문구가 날짜를 넘겨 남지 않게)

## 3. US2·US3 — 적립과 내 포인트 (P1·P2)

- [X] T020 [US3] `frontend/src/lib/points.ts`: `fetchMyPoints()`, `fetchMyLedger()`
- [X] T021 [US3] `frontend/src/app/me/page.tsx`: 활동 포인트 카드(합계·순위·최근 내역·쓰임 안내)
- [X] T022 [US2] `frontend/src/app/admin/reports/page.tsx`: «100P 적립» 표시와 적립 안내, `admin/members/page.tsx`: 별명 옆 포인트

## 4. US4 — 이름과 문구 (P2)

- [X] T030 [US4] `frontend/src/components/ui/TipBand.tsx`: «숨은 행사 찾기», 실리면 100포인트, 쿠폰은 12월까지
- [X] T031 [US4] `frontend/src/app/terms/page.tsx`(7조 활동 포인트)·`privacy/page.tsx`(적립 내역, 로그인 제보, 쿠폰 연락처 12월까지), 변경 고지

## 5. US5 — 카카오 제보 (P3)

- [X] T040 [US5] 017 세션에 요청(11/27): 챗봇 `appUserId` → 회원 잇기(`leaflet_submissions.user_id`), 오픈빌더 앱키 설정. 이 명세의 트리거는 준비됨(회원이 이어진 kakao_bot 줄이 published 가 되면 +100)

## 5-1. 함께 넣은 관리자 화면 (운영자 11/27 «클릭하면 더 자세히 볼수 있게 카드형태로», «하위에 어느 부분에서 1인지», «현황1이 무슨 의미인지 모르겠음»)

- [X] T045 `frontend/src/app/admin/reports/page.tsx`: 목록을 카드로(제목·날짜·장소·링크 출처·사진·쿠폰 연락처·메모 표시), 카드를 누르면 자세히 보기 창(사진 바로 열림, 보낸 글, 메모, 반영함·반영 안 함·행사로 등록·다시 열기). 처리하면 메뉴 숫자도 바로 맞춤
- [X] T046 `frontend/src/components/admin/AdminShell.tsx`: 둘째 줄 칩에 건수(리플렛·신고·제보·협약 신청 = 대기함 숫자를 이루는 것), 현황 숫자를 «경고 n»으로 쓰고 마우스를 올리면 첫 경고 내용, «운영 현황» 칩에도 «경고 n»

## 6. 확인·마무리

- [X] T050 `npx tsc --noEmit` + `next build --webpack`
- [X] T051 로컬 화면(11/27): 로그인 전 `/tip` — 제목 «숨은 행사 찾기», 입력 칸 0개, «로그인하고 제보하기»(→ `/login?next=/tip`), 띠 문구, 폭 375px 가로 넘침 0. 관리자 계정: `/tip`에 칸과 «내가 보낸 제보»(확인 중·반영하지 않음), `/me`에 «활동 포인트 0P»와 쓰임 안내(운영 DB에 함수가 아직 없어 0으로 보임), 신고·제보 카드 → 자세히 보기 창(사진·버튼 3개), 메뉴 «대기함 3»·칩 «신고·제보 1»·«협약 신청 2», «현황 경고 1»(풀이: discover_instagram.py 수집 실패)
- [X] T052 커밋, 보고
- [ ] T053 (운영자 «배포해» 뒤) 운영 DB 적용 → main 배포 → 운영 주소에서 제보 → 반영함 → 100P → 반영 안 함 → 0P
