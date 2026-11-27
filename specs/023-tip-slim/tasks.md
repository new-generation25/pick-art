# Tasks: 제보 노출 줄이기 · 사이트는 로그인 · 동의 체크 통합

**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## 1. US1 — 제보 안내 겹침 줄이기 (P1)

- [X] T001 [US1] `frontend/src/components/ui/TipBand.tsx`: `showTipBand()` 가 `/` 와 `/region/…` 에서만 true
- [X] T002 [US1] `frontend/src/components/ui/SiteFooter.tsx`: «리플렛으로 알리기» 링크 삭제

## 2. US3 — 사이트는 로그인 (P1)

- [X] T010 [US3] `frontend/src/lib/inApp.ts`: `inAppBrowser(ua)` — 인스타그램·페이스북·카카오톡·네이버·라인 앱 안, 안드로이드 웹뷰 판정(앱 이름 또는 null)
- [X] T011 [US3] `frontend/src/components/ui/InAppNotice.tsx`: «외부 브라우저(크롬·사파리)로 열기» 안내, 주소 복사 단추, 안드로이드는 «크롬으로 열기» 링크. 앱 안 브라우저가 아니면 아무것도 그리지 않음
- [X] T012 [US3] `app/login/page.tsx`, `app/tip/TipForm.tsx`, `app/tip/leaflet/LeafletForm.tsx` 의 로그인 안내에 `InAppNotice`
- [X] T013 [US3] `components/partners/AgreementForm.tsx`: 로그인하지 않았으면 신청 칸 대신 로그인 안내(+`InAppNotice`), 주석·아래 안내 글의 «로그인하지 않아도 돼요» 삭제
- [X] T014 [US3] `supabase/migrations/20261127180000_agreement_login_required.sql`: `submit_partner_agreement()` 로그인 필수, anon 실행 권한 회수

## 3. US4 — 동의 체크 통합 (P1)

- [X] T020 [US4] `frontend/src/lib/partnerAgreement.ts`: `CONSENT_ITEMS`(네 항목 한 줄씩), `checkAgreement` 오류 글, `TERMS_VERSION` 올림
- [X] T021 [US4] `AgreementForm.tsx`: «전체 동의» 체크 하나(네 값 모두 설정), 목록, 개인정보 항목 구분, 이미지 선택은 그대로, 전문 펼침
- [X] T022 [US4] `frontend/src/lib/leaflets.ts` + `LeafletForm.tsx`: 권리 확인 체크 하나(`RIGHTS_ONE`), 풀이 문장, 사이트 제출은 `RIGHTS_VERSION_SITE`(r2) 로 저장 — 카카오톡·관리자 채팅 등록이 쓰는 `RIGHTS_VERSION`·`RIGHTS_CHECKS` 는 그대로

## 4. US2 — «내 정보»·제보 화면 줄이기 (P2)

- [X] T030 [US2] `app/me/page.tsx`: «활동 포인트» 카드는 포인트 기록이나 보낸 제보가 있을 때만, `KakaoLinkCard` 를 계정 정보 카드 위로
- [X] T031 [US2] `lib/reports.ts` `COUPON_NOTE` 한 줄, `app/tip/TipForm.tsx` 접힌 칸 «선택 항목» 하나(쿠폰 연락처·동의 + 이름 남기기)

## 5. 확인·마무리

- [X] T040 `npx tsc --noEmit` + `next build --webpack`
- [X] T041 로컬 화면(폭 375px, 로그인 안 함, 2026-11-27): 띠 — 홈 1·`/region/gimhae` 1·행사 상세 0·`/about` 0·`/partners` 0·`/tip` 0, 꼬리말 제보 링크는 모두 «행사 제보하기» 1개, 상세에는 «정보가 틀렸어요» 단추만, `/partners#join` 은 «로그인하고 신청하기» → `/login?next=%2Fpartners%23join`, `/tip` 머리말 쿠폰 한 줄, 가로 넘침 0. `inAppBrowser()` 브라우저 문자열 6개(인스타그램·카카오톡·안드로이드 웹뷰·크롬·사파리·PC) 통과. **보지 못한 것**: 로그인 뒤 화면(협약 신청·리플렛 체크박스 수, `/tip` «선택 항목», `/me` 카드 순서) — 로컬에서 구글 로그인을 누르면 운영으로 가서 로그인 상태를 만들 수 없음. 앱 안 브라우저 안내의 실제 모습(휴대폰 인스타그램 앱)
- [X] T042 운영 DB 시험 실행(`checks/dryrun.sql`, 끝에 예외로 모두 되돌림, 2026-11-27): 익명 호출 «permission denied for function submit_partner_agreement», 로그인 호출 1건 들어감, anon 실행 권한 false. 되돌린 뒤 시험 줄 0건·신청 4건 그대로
- [X] T043 커밋, 보고
- [X] T044 운영자 «가져와서 배포해»(2026-11-27 밤) → 017 브랜치(df994cc) 합침 → main 3f3f6b2 배포(Vercel – pick-art success, 2026-11-28 00시대) → 운영 DB 에 `20261127180000_agreement_login_required.sql` 적용. 운영 확인: 로그인 안 한 375px — 홈 칩 «이번 주» 켜짐·선반 오늘/이번 주·알약 «지도 87px»+«제보하기 111px»·띠 1·꼬리말 제보 링크 1, `/partners` 띠 0·«지금까지 3곳과 파트너십을 맺었어요.»·필수 체크 1·버튼 «로그인하고 보내기», 가로 넘침 0. 로그인 없는 `submit_partner_agreement` 호출은 401 «permission denied». 관리자 계정(MAX 크롬) — `/partners` 에 남의 신청이 보이지 않음, `/me` 카카오톡 카드가 계정 정보 바로 위, `/tip` 접힌 칸 2개(«더 알려 주기»·«선택 항목»), `/tip/leaflet` 체크 1개. 로그아웃: 누르면 홈이 새로 열리고 «로그인» 버튼·저장된 로그인 0건, 다른 탭의 `/admin/partners` 는 `/login?next=%2Fadmin%2Fpartners` 로 이동. **보지 못한 것**: 일반 회원(관리자 아님)의 `/me`(포인트 카드 숨김), 휴대폰 인스타그램 앱 안 브라우저의 로그인 안내, 017 의 10분 마이그레이션(017 세션이 적용)
- [X] T045 (배포 직전 추가, 운영자 11/27~28) 홈 «지도» 옆 «제보하기» 알약, 기간 기본값 «이번 주»(`lib/homeDate.ts`), 협약 양식은 로그인 없이 보이고 버튼만 «로그인하고 보내기»(적던 내용 유지), 앱 안 브라우저 안내는 `/login` 에만, 동의 칸을 상자 하나(체크 1 + 네 줄 + 이미지 고르기 + «자세히 보기»)로, «내가 보낸 신청»은 본인 것만, `/partners` 에 파트너십 수

- [X] T015 [US3] `app/privacy/page.tsx`: 협약 신청 줄을 «로그인한 회원만»으로, 변경 고지 한 줄
