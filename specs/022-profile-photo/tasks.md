# 022 작업 목록 — 프로필 사진 올리기 · 관리자 까치 그림

명세 [spec.md](spec.md) · 계획 [plan.md](plan.md). 로컬 확인 → 운영자 «배포해» → 운영 DB 적용·배포·운영 주소 확인.

## 1. 바탕 (DB·저장소)

- [X] T001 `supabase/migrations/20261127160000_profile_avatar.sql`: `profiles.avatar_path`(CHECK: 자기 id 로 시작하는 `<id>/<36자>.jpg`), 버킷 `avatars`(비공개, 1MB, image/jpeg), 자기 폴더만 올리기·읽기·지우기 정책, `storage_usage()`에 프로필 사진 더하기
- [X] T002 운영 DB 되돌림 시험(11/28, `checks/make_dryrun.py` → `checks/dryrun.sql`, 남는 변경 없음 — 뒤에 `profiles.avatar_path` 없음·버킷 3개 그대로 확인): 12개 항목 통과 — 자기 경로 저장, 남의 경로·형식 다른 경로 거절, 저장소에 자기 폴더 넣기 가능·남의 폴더와 익명 거절, 다른 회원은 내 파일 줄 0개·내 회원 기록 고치기 0줄, 버킷 비공개·1MB. 저장소 지우기 권한은 SQL 로 시험할 수 없다(Supabase 가 저장소 표의 직접 DELETE 를 막음) — 배포 뒤 저장소 API 로 확인

## 2. US1 — 사진 올리고 지우기 (P1)

- [X] T010 [US1] `frontend/src/lib/avatar.ts`: `squareJpeg`(가운데 정사각 512px JPEG), `uploadAvatar`·`removeAvatar`, `avatarUrl`(서명 주소 1시간, 50분 기억), `AVATAR_EVENT`
- [X] T011 [US1] `frontend/src/components/ui/Avatar.tsx`: 사진 → 관리자 까치 → 사람 그림
- [X] T012 [US1] `frontend/src/app/me/page.tsx`: 프로필 원, «고치기» 안 «사진 올리기/바꾸기»·«사진 지우기»
- [X] T013 [US1] `frontend/src/components/ui/Header.tsx`: 내 정보 버튼 안을 프로필 원으로, 사진이 바뀌면 바로 반영

## 3. US2 — 본인만 (P1)

- [X] T020 [US2] 정책·CHECK 는 T001. `frontend/src/app/privacy/page.tsx`: 처리 항목·보유 기간·변경 고지
- [X] T021 [US2] `collector/tools/leaflet_queue.py` `cleanup()`: 회원 기록이 가리키지 않는 프로필 사진 지우기(올린 지 하루 넘은 것만), `collector/tests/test_leaflet_queue.py` 시험

## 4. US3 — 관리자 까치 (P2)

- [X] T030 [US3] `Avatar` 의 `admin`: 종이색(#F4EFE6) 원 안 `/icons/logo-mark.png`. 머리 줄과 «내 정보» 모두 `profiles.role = 'admin'` 으로 판정

## 5. 확인·마무리

- [X] T040 `npx tsc --noEmit` + `next build --webpack` + `pytest collector/tests`(264 통과)
- [X] T041 로컬 화면(11/28, 관리자 계정): 머리 줄 원 44px·«내 정보» 원 60px 모두 종이색 바탕에 까치 그림, «고치기»에 «사진 올리기»와 안내 글, 가로 넘침 0(PC 폭). 운영 DB에 버킷이 아직 없어 올리기 자체와 일반 회원의 흰 원, 375px 폭은 보지 못함
- [X] T042 커밋, 보고
- [ ] T043 (운영자 «배포해» 뒤) 운영 DB 적용 → main 배포 → 운영에서 사진 올리기 → 두 원에 보임 → 새로 불러와도 그대로 → 지우기 → 까치
