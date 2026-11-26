# 016 확인 기록 (2026-11-26)

## DB (운영 bebnijyqhzcftvlueeyn, MAX Chrome SQL 편집기)
- 적용: `20261127040000_partner_agreements.sql`, `20261127050000_partner_agreements_min.sql`, `20261127060000_partner_agreements_anon.sql` → 모두 «Success. No rows returned».
- RLS 흉내(트랜잭션 안 가짜 회원 2명, RAISE 로 되돌림):
  `u1 admin false | insert ok | collect=false rejected | self-confirm rejected | insert 2,3 ok | 4th rejected | u1 sees 3 | u1 update rows 0 | withdraw true | u2 sees 0 | u2 withdraw other false | admin sees 3 | admin update rows 1`
- 관리자 처리 흉내(«협약 확인»·«철회 처리»와 같은 순서, 되돌림):
  `found true user_id null true | todo count 1 | confirmed rows 1 org partner_since 2026-11-26 | withdrawn rows 1 org partner_since NULL`

## 익명 REST (anon 키)
- `partner_agreements` 읽기 → `[]`
- 표에 직접 넣기 → 401
- `request_partner_withdrawal` → 42501 permission denied
- `submit_partner_agreement` 에 자동 수집 false → 23514(CHECK 위반)로 거절

## 로컬 화면 (next build --webpack + next start, 375×812)
- /partners: 예술가용 머리말 → «이렇게 실려요»(이름 가린 예시) → «하실 일» 3단계 → 실리면 생기는 것 → 약속 → #join 동의 칸 → 자주 묻는 것 → (접힘) 기관 담당자용 설명.
- 빈 채로 «동의하고 보내기» → 빠진 항목 7개 안내.
- 로그인 없이 «[시험] 피카 확인용 극단» 보내기 → «받았어요» 화면, DB에 user_id 없는 new 줄 1건(위 관리자 흉내에서 found true).
- 관리자 화면 클릭 확인은 못 함: 내장 브라우저에 구글 로그인이 없어 로컬 관리자 로그인 불가(비밀번호 입력은 하지 않음). 운영자 검토 때 /admin/partners 에서 확인.

## 남은 것
- 운영자 휴대폰 화면 검토·승인 → 배포.
- 시험 줄 «[시험] 피카 확인용 극단»: 운영자 화면 확인 뒤 지운다(«협약 확인»은 누르지 않는다 — 공개 단체가 생김).
