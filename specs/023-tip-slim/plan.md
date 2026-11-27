# Implementation Plan: 제보 노출 줄이기 · 사이트는 로그인 · 동의 체크 통합

**Spec**: [spec.md](spec.md) · **Date**: 2026-11-27

## Technical Context

Next.js 16(App Router, webpack 빌드) · Tailwind 4 종이 테마 · Supabase(운영 프로젝트). 새 의존성 없음. 화면 문구는 `docs/BRAND_GUIDE.md` 말투(«~해요», 과장 없음)를 따른다.

## Constitution Check

- I 확인한 정보만 공개: 제보·리플렛·협약 모두 운영자 확인 뒤 공개하는 흐름은 그대로. 통과.
- II 브랜드 가이드: 새 문구는 기존 화면 말투 그대로, 새 색·글꼴 없음. 통과.
- III 보안: 협약 신청 함수의 익명 실행 권한을 거둔다(더 좁아짐). 비밀값 없음. 운영 DB 적용은 운영자 «배포해» 뒤. 통과.
- IV AI 최소 개입: 해당 없음.
- V 끝 조건: spec 의 SC-001~005 를 로컬 빌드 화면과 DB 시험 실행(되돌림)으로 확인한다.

## 바꾸는 곳

| 요구 | 파일 | 내용 |
|---|---|---|
| FR-001 | `frontend/src/components/ui/TipBand.tsx` | `showTipBand()` 를 «홈(`/`, `/region/…`)만 true» 로 |
| FR-002 | `frontend/src/components/ui/SiteFooter.tsx` | «리플렛으로 알리기» 링크 삭제 |
| FR-003 | `frontend/src/app/me/page.tsx` | 포인트 카드 조건(포인트 기록 또는 보낸 제보 수 > 0), `KakaoLinkCard` 를 계정 정보 카드 위로 |
| FR-004 | `frontend/src/lib/reports.ts`, `app/tip/page.tsx`, `app/tip/TipForm.tsx` | `COUPON_NOTE` 한 줄, 접힌 칸 «선택 항목» 하나 |
| FR-005 | `components/partners/AgreementForm.tsx`, `supabase/migrations/20261127180000_agreement_login_required.sql` | 로그인 안내 화면, `submit_partner_agreement()` 가 로그인 없으면 `login_required`, anon 실행 권한 회수 |
| FR-006 | `frontend/src/lib/inApp.ts`(새), `components/ui/InAppNotice.tsx`(새), `app/login/page.tsx`, `TipForm`·`LeafletForm`·`AgreementForm` 의 로그인 안내 | UA 로 앱 안 브라우저 판정, 안내 + 주소 복사 + (안드로이드) 크롬으로 열기 |
| FR-007 | `frontend/src/lib/partnerAgreement.ts`, `AgreementForm.tsx` | «전체 동의» 체크 하나 → 네 값 모두 true, 목록·개인정보 구분, `TERMS_VERSION` 올림 |
| FR-008 | `frontend/src/lib/leaflets.ts`, `app/tip/leaflet/LeafletForm.tsx` | `RIGHTS_CHECKS` 하나 + 풀이, `RIGHTS_VERSION` 올림 |

## DB

`submit_partner_agreement(jsonb)`: `auth.uid()` 가 없으면 `RAISE EXCEPTION 'login_required'`. `REVOKE EXECUTE … FROM anon`. `partner_agreements.user_id` 는 그대로 NULL 허용(로그인 없이 받은 기존 3건 유지). 되돌리기: 20261127060000 의 함수 정의를 다시 실행하고 anon 에 권한을 준다.

마이그레이션 번호: 017 세션의 `kakao_tip_10min` 이 20261127170000 을 쓰기로 해 20261127180000 을 쓴다.

## 다른 세션과 겹치는 파일

`partners/page.tsx`, `tip/TipForm.tsx`, `lib/reports.ts` 는 017 브랜치(2789cc6)가 몇 줄 고쳤다(«행사 알리기»→«행사 제보하기» 등). 이 명세는 `partners/page.tsx` 를 고치지 않고, 나머지 둘은 합칠 때 맞춘다.

## 확인 방법

- `npx tsc --noEmit`, `next build --webpack`.
- 로컬(로그인 안 한 내장 브라우저, 폭 375px): 홈·상세·`/about`·`/partners` 의 띠 수, 꼬리말 제보 링크 수, 협약 신청 로그인 안내, `/tip`·`/tip/leaflet` 로그인 안내, 가로 넘침.
- 체크박스 수는 로그인 뒤 화면이라 로컬에서 볼 수 없다(로컬에서 구글 로그인을 누르면 운영으로 간다) → 폼 조각을 떼어 보거나 배포 뒤 운영에서 확인.
- DB: 운영 SQL 편집기에서 마이그레이션 + 시험을 한 문장으로 돌리고 끝에 예외로 모두 되돌린다(익명 호출 거절, 로그인 호출 통과).
