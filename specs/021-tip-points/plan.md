# 021 계획 — 숨은 행사 찾기: 로그인 제보와 활동 포인트

명세: [spec.md](spec.md) · 작성 2026-11-27 · 020([../020-tip-event/plan.md](../020-tip-event/plan.md))의 접수 방식을 바꾸고 포인트를 더한다.

## 헌장 점검

| 원칙 | 이 기능에서 |
|---|---|
| I. 확인한 정보만 공개 | 포인트는 운영자가 확인해 «반영함»으로 닫을 때만 생긴다. 제보의 공개 흐름은 그대로 |
| II. 브랜드 가이드 | 문구 해요체, 숫자 먼저(«실리면 100포인트»), 쓰지 않는 말 없음 |
| III. 보안과 비밀값 | 적립 내역은 본인·관리자만 읽고, 넣는 길은 DB 트리거뿐이다(회원이 자기 포인트를 고칠 수 없게 `profiles`에 칸을 두지 않음) |
| IV. AI 최소 개입 | 해당 없음 |
| V. 끝 조건 먼저 | 아래 «확인 방법» |

## 데이터 (마이그레이션 `supabase/migrations/20261127140000_points.sql`)

### `point_ledger` (새 표)

| 칸 | 내용 |
|---|---|
| `user_id` | 받는 회원(탈퇴하면 함께 삭제) |
| `amount` | 증감(0 아님) |
| `reason` | `tip`(행사 제보). 다른 사유는 나중에 CHECK 에 더한다 |
| `ref_table`·`ref_id` | 어느 줄 때문인지(`reports` 또는 `leaflet_submissions` 의 id). `(reason, ref_table, ref_id)` 고유 → 한 건에 한 번 |
| `created_at`·`created_by` | 언제, 누가 닫아서 생겼는지 |

RLS: SELECT 는 본인 또는 관리자. INSERT·UPDATE·DELETE 정책 없음(트리거 함수만 넣고 뺀다).

### 적립 트리거

- `reports`: `kind='tip'` 이고 `user_id` 가 있는 줄의 `status` 가 `done` 이 되면 +100, `done` 에서 벗어나면 그 줄을 지운다.
- `leaflet_submissions`: `channel='kakao_bot'` 이고 `user_id` 가 있는 줄의 `status` 가 `published` 가 되면 +100, 벗어나면 지운다. 지금은 카카오 제보의 `user_id` 가 늘 비어 있어 동작하지 않는다 — 017 세션이 챗봇 사용자와 회원을 이으면 그때부터 쌓인다. 리플렛(`web`)·운영자가 옮겨 올린 것(`kakao_chat`)은 대상이 아니다.

### 함수

- `my_points()` → `{points, rank, ranked}`: 내 합계, 포인트가 있는 회원 가운데 내 순위, 그 회원 수. 다른 회원의 값은 돌려주지 않는다.
- `admin_member_points()` → `(user_id, points)`: 관리자만.
- `submit_tip(jsonb)`: 로그인하지 않았으면 `login_required`. 익명 한도(40건/일) 분기는 없앤다. 실행 권한에서 anon 을 뺀다.
- `tip_upload_allowed(name)`·`tip_photo_failed(id)`: 그 제보를 보낸 회원 본인일 때만. 저장소 정책 «Tip upload pending photo»는 authenticated 만.

`reports.user_id` 는 NULL 허용으로 둔다(020 때 로그인 없이 들어온 줄이 있다).

## 화면

| 자리 | 파일 | 바뀌는 것 |
|---|---|---|
| 문구·상수 | `frontend/src/lib/reports.ts` | `TIP_POINTS=100`, `COUPON_UNTIL="2026-12-31"`·`couponOpen()`, 당첨 공지 문구, 포인트 쓰임 문구, `login_required` 오류 문구 |
| 포인트 읽기 | `frontend/src/lib/points.ts` | `fetchMyPoints()`, `fetchMyLedger()` |
| 제보 화면 | `frontend/src/app/tip/page.tsx`, `TipForm.tsx` | 제목 «숨은 행사 찾기», 로그인 전에는 안내 + «로그인하고 제보하기», 쿠폰 칸은 `couponOpen()` 일 때만, 보낸 뒤 «실리면 100포인트», «내가 보낸 제보» |
| 제보 띠 | `frontend/src/components/ui/TipBand.tsx` | 제목 «숨은 행사 찾기», «실리면 100포인트 · 12월까지 매주 5명께 커피 쿠폰» |
| 내 정보 | `frontend/src/app/me/page.tsx` | 활동 포인트 카드(합계·순위·최근 내역·쓰임 안내) |
| 관리자 | `frontend/src/app/admin/reports/page.tsx`, `admin/members/page.tsx` | 제보 줄에 «100P 적립», 회원 목록에 포인트 |
| 약관·방침 | `frontend/src/app/terms/page.tsx`, `privacy/page.tsx` | 활동 포인트 조항, 적립 내역·로그인 제보 반영, 변경 고지 |

## 카카오톡 채널 제보 (017 세션에 넘김)

- 챗봇 스킬이 받는 값 가운데 `appUserId`(오픈빌더 봇 설정에 앱키를 넣었을 때만 옴, specs/017 research.md)가 카카오 로그인의 회원번호와 같으면 피카 회원을 찾을 수 있다. 운영자가 오픈빌더에서 앱키를 넣어야 하고, 실제로 그 값이 오는지 017 세션이 확인한다.
- 017 이 할 일: 스킬 서버가 `appUserId` 를 `kakao_intake` 에 넘기고, 함수가 카카오 로그인 회원을 찾아 `leaflet_submissions.user_id` 에 넣는다(`leaflet_submissions_sender_check` 를 kakao_bot 도 user_id 를 가질 수 있게 고침). 그러면 이 명세의 트리거가 적립한다.
- 그 전까지 화면에는 카카오 제보의 포인트를 약속하지 않는다.

## 배포 순서

1. 운영 DB 적용 → 바로 2. main 배포. 그 사이 몇 분 동안은 낮에 배포한 화면(로그인 없는 칸)에서 보내면 «보내지 못했어요»가 나온다.
3. 운영 주소 확인.

## 확인 방법

1. 운영 DB 되돌림 시험(한 문장 안에서 적용 → 시험 → 전부 되돌림): 익명 접수 거절, 회원 접수, 반영함 → +100, 다시 저장해도 +100 한 번, 반영 안 함 → 0, 익명·다른 회원이 내역을 못 읽음, `my_points()` 값, 카카오 제보 줄에 회원이 있으면 +100
2. `tsc --noEmit` + `next build --webpack`
3. 로컬 화면: 로그인 전 `/tip` 안내, 띠 문구, 폭 375px 가로 넘침 0
4. 배포 뒤: 관리자 계정으로 제보 1건 → «반영함» → «내 정보»에 100P → «반영 안 함» → 0P
