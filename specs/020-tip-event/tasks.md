# 020 작업 목록 — 숨은 행사 제보

명세 [spec.md](spec.md) · 계획 [plan.md](plan.md). 로컬 빌드·화면 확인 → 운영자 «배포해» → 운영 DB 적용·배포·운영 주소 확인.

## 1. 바탕 (DB)

- [X] T001 마이그레이션 `supabase/migrations/20261127130000_tip_event.sql`: `reports.user_id` NULL 허용, 새 칸 `photo_path`·`credit_name`(1~30자)·`reward_contact`(5~100자, 있으면 `reward_consent` 필수)·`reward_consent`(40자 이하)·`reward_sent_at`, CHECK `reports_tip_has_fields`(title + url 또는 photo), CHECK `user_id IS NOT NULL OR kind = 'tip'`, 회원 직접 넣기 정책 좁히기, `events.tip_credit`(1~30자)
- [X] T002 같은 파일: `submit_tip(jsonb)`(한도 익명 40건/일·회원 10건/일, 같은 이름·링크 하루 한 번, 보이지 않는 칸), `tip_upload_allowed(text)` + 저장소 정책, `tip_photo_failed(uuid)`, `storage_usage()`에 `reports.photo_path` 더하기
- [X] T003 운영 DB에서 한 문장(DO 블록) 안에서 적용 → 시험 → 끝에서 오류를 내어 전부 되돌림(11/27, 남는 변경 없음 — 뒤에 `reports` 2줄·새 칸 없음·`submit_tip` 없음 확인): 익명 넣기 성공, 이름만 → `need_source`, 연락처+동의 없음 → `need_consent`, 같은 이름·링크 두 번 → `duplicate`, 익명 읽기 0줄, 회원 직접 넣기(오류 신고 모양) 통과 — 21개 항목 모두 통과. 저장소 올리기 정책과 `storage_usage()` 실행은 시험하지 않았다(정의만 확인)

## 2. US1 — 로그인 없이 제보 (P1)

- [X] T010 [US1] `frontend/src/lib/reports.ts`: `TipInput`(title·url·date_start·date_end·venue·region·body·contact·consent·credit·website), `checkTip(t, hasPhoto)`, `tipErrorText(code)`, `REWARD_CONSENT_VERSION = "tip-reward-r1-2026-11-27"`, `KAKAO_CHAT`, `normalizeTipUrl`(http 없이 붙인 주소에 https:// 붙임)
- [X] T011 [US1] `frontend/src/app/tip/TipForm.tsx` 다시 쓰기: 로그인 문턱 삭제, 이름·링크·사진, 접은 칸 «더 알려 주기», 사진은 긴 변 2,048px JPEG로 줄여 `leaflets/tips/<id>.jpg`에 올림, 실패하면 `tip_photo_failed`
- [X] T012 [US1] `frontend/src/app/tip/page.tsx`: 제목·설명·이벤트 한 줄·카카오톡 안내·«부산·경남 행사를 실어요»

## 3. US2 — 제보 띠 (P1)

- [X] T020 [US2] `frontend/src/components/ui/TipBand.tsx` + `frontend/src/components/MainLayout.tsx`: 꼬리말 위 띠, 숨기는 경로 `/tip`·`/login`·`/signup`·`/welcome`·`/auth`

## 4. US3 — 쿠폰 연락처 (P2)

- [X] T030 [US3] `TipForm.tsx`: «커피 쿠폰 받기»(연락처 + 동의 문구), 동의 없이 연락처만 적으면 막음
- [X] T031 [US3] `frontend/src/app/admin/reports/page.tsx`: 연락처 표시, «쿠폰 보냄 · 연락처 지우기», 갈래 «쿠폰 대상», 이번 주 요약 한 줄, 화면을 열 때 90일 지난 연락처 비우기
- [X] T032 [US3] `collector/tools/leaflet_queue.py` `cleanup()`: 90일 지난 쿠폰 연락처 비우기 + 1년 지난 제보 사진 지우기, `collector/tests/test_leaflet_queue.py`에 시험 추가
- [X] T033 [US3] `frontend/src/app/privacy/page.tsx`: 처리 항목·보유 기간·변경 고지

## 5. US4 — 관리자 확인·이름 표시 (P2)

- [X] T040 [US4] `admin/reports/page.tsx`: 보낸 사람 구분(회원/로그인 없이), «사진 보기»(10분짜리 주소, 실패하면 «사진 없음»), 표시 이름
- [X] T041 [US4] `frontend/src/app/admin/events/new/page.tsx`: 제보의 `credit_name`을 읽어 «행사 화면에 제보: ○○ 보이기» → `events.tip_credit`
- [X] T042 [US4] `frontend/src/app/events/[id]/page.tsx`: `tip_credit`이 있으면 «제보» 줄

## 5-1. 수집 쪽 요청(「문화정보 수집」 세션, 11/27) — 주간 집계를 칸으로

- [X] T045 «행사로 등록»이 제보에 행사 id 를 남김(`reports.event_id`, 처리 시각은 `handled_at`): `frontend/src/app/admin/events/new/page.tsx`. 관리자 «신고·제보»에 «등록한 행사 보기»
- [X] T046 보기 `public.tip_entries`(사이트 제보 + 카카오톡 채널 제보를 한 줄 모양으로, `security_invoker`, 수집기 service_role 만 읽음, 연락처 값 없음): 같은 마이그레이션. 카카오 제보는 017 흐름(`leaflet_submissions`) 그대로 둠
- [X] T047 운영 DB 되돌림 시험 다시(11/27): 28개 항목 모두 통과(보기의 사이트·카카오 줄 수, 익명·회원 읽기 막힘, 행사 id 잇기 포함). 뒤에 `reports` 2줄·새 칸·보기 없음 확인

## 6. 확인·마무리

- [X] T050 `npx tsc --noEmit` + `next build --webpack`
- [X] T051 로컬 화면(11/27, 로그인하지 않은 브라우저): `/tip`에 로그인 문턱 없음, 빈 양식 → «행사 이름을 적어 주세요»·«링크나 사진 가운데 하나는 필요해요», 이름만 → 링크·사진 문구, 연락처+동의 없음 → «연락처를 남기려면 동의가 필요해요», `instagram.com/p/abc`처럼 http 없는 주소는 검사를 통과해 접수 함수까지 감(운영 DB에 함수가 아직 없어 «보내지 못했어요»로 끝남 — 실제 저장은 배포 뒤 T054에서 확인). 띠: 홈·행사 상세·`/about`·`/partners`에 있고 `/tip`·`/tip/leaflet`·`/login`에 없음. 폭 375px에서 홈·행사 상세·`/tip`(접은 칸 모두 펼침) 가로 넘침 0. 관리자 «신고·제보»는 갈래 3개와 기존 2건이 그려짐(새 칸 표시는 배포 뒤 확인)
- [X] T052 `pytest collector/tests`
- [X] T053 커밋(revive/2026-10), 요청한 세션에 보고(공유 노트 `2026-11-27_tip_event_built.md`)
- [ ] T054 (운영자 «배포해» 뒤) 운영 DB 마이그레이션 적용 → main 배포 → 운영 주소에서 시험 제보 2건(링크 / 사진+연락처) → 관리자 화면 확인 → 연락처 지우기 → 시험 제보 «반영 안 함»
