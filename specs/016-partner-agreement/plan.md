# 016 계획

## 구성
- **DB**
  - `20261127040000_partner_agreements.sql`: 표·인덱스·RLS·`my_partner_agreements_today()`·`request_partner_withdrawal(uuid)`.
  - `20261127050000_partner_agreements_min.sql`: 대표자 선택.
  - `20261127060000_partner_agreements_anon.sql`: user_id 선택, `submit_partner_agreement(jsonb)`(익명 하루 20·회원 3·중복 1).
- **문구** `frontend/src/lib/partnerAgreement.ts`: `TERMS_VERSION`, `IS_DRAFT`, `CONSENT_SUMMARY`, `AFTER_SUBMIT`, `TERMS_SECTIONS`, `PRIVACY_NOTICE`, 검사 `checkAgreement()`, `toRow()`, `normInsta()`, `orgNormName()`.
- **공개 화면** `frontend/src/app/partners/page.tsx`(순서 재배치), `frontend/src/components/partners/AgreementForm.tsx`(#join).
- **관리자** `frontend/src/app/admin/partners/page.tsx`, 메뉴 `AdminHeader.tsx`, 첫 화면 `admin/page.tsx`.
- **개인정보처리방침** `frontend/src/app/privacy/page.tsx`.

## 헌장 점검
- I 확인한 정보만: 보낸 것만으로 협약 표시하지 않는다. 운영자 «협약 확인» 뒤에만 `partner_since`. «지금/준비 중» 표시 유지. 예시는 이름 가림.
- III 보안: 익명은 함수로만 넣고 표를 읽지 못한다. 서비스 키를 쓰지 않는다. 접속 정보 저장 안 함.
- V 끝 조건: 아래.

## 확인 (끝 조건)
1. 익명 REST: 표 읽기 `[]`, 표 직접 넣기 401, 철회 함수 권한 없음, 함수로 필수 동의 false → 23514.
2. SQL(역할 흉내, 되돌림): 회원 넣기·필수 동의 거절·스스로 확인 거절·하루 4번째 거절·남의 것 안 보임·관리자만 수정.
3. 로컬(휴대폰 크기): /partners 캡처, #join 에서 보내기 → «받았어요» → /admin/partners 에 보임 → 협약 확인 → orgs.partner_since. 시험 줄은 끝나고 지운다.
4. 운영자 휴대폰 화면 검토·승인 → 배포.
