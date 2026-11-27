# 022 계획 — 프로필 사진 올리기 · 관리자 까치 그림

명세: [spec.md](spec.md) · 작성 2026-11-27

## 헌장 점검

| 원칙 | 이 기능에서 |
|---|---|
| I. 확인한 정보만 공개 | 해당 없음(행사 정보가 아님) |
| II. 브랜드 가이드 | 머리 줄 시안 h01-B의 원 모양(흰 원 + 1.5px #CFC5B4), 까치는 확정 로고 윗부분, 문구 해요체 |
| III. 보안과 비밀값 | 사진은 비공개 저장소에 두고 본인만 읽고 쓴다. 회원 기록에는 자기 폴더의 경로만 적을 수 있다(CHECK). 사진은 줄여서 다시 저장해 위치 정보가 빠진다 |
| IV. AI 최소 개입 | 해당 없음 |
| V. 끝 조건 먼저 | 아래 «확인 방법» |

## 데이터 (마이그레이션 `supabase/migrations/20261127160000_profile_avatar.sql`)

- `profiles.avatar_path` (새 칸): `<회원 id>/<파일 id>.jpg`. CHECK 로 자기 id 로 시작하는 경로만 허용한다. 없으면 NULL.
- 버킷 `avatars`: 비공개, 1MB, `image/jpeg`만.
- 저장소 정책(authenticated, 자기 폴더만): 올리기(INSERT)·읽기(SELECT)·지우기(DELETE). 고치기(UPDATE) 정책은 두지 않는다 — 바꿀 때마다 새 파일 이름으로 올리고 옛 파일을 지운다.
- `storage_usage()`: `profiles.avatar_path` 를 «쓰는 파일»로 센다(관리자 저장공간 화면의 «안 쓰는 파일 비우기»에 걸리지 않게).

비공개 버킷이라 화면은 1시간짜리 서명 주소로 보여 준다. 머리 줄이 화면마다 다시 받지 않게 브라우저(sessionStorage)에 50분 동안 기억한다.

## 화면

| 자리 | 파일 | 바뀌는 것 |
|---|---|---|
| 사진 줄이기·올리기 | `frontend/src/lib/avatar.ts` | `squareJpeg(file)`(가운데 정사각 512px JPEG), `uploadAvatar`·`removeAvatar`, `avatarUrl(path)`(서명 주소 + 기억), `AVATAR_EVENT`(머리 줄에 바뀜 알림) |
| 프로필 원 | `frontend/src/components/ui/Avatar.tsx` | 사진 → 관리자 까치 → 사람 그림 순서로 그린다. 크기만 받는다 |
| 내 정보 | `frontend/src/app/me/page.tsx` | 프로필 원을 `Avatar`로, «고치기» 안에 «사진 바꾸기»·«사진 지우기» |
| 머리 줄 | `frontend/src/components/ui/Header.tsx` | 내 정보 버튼 안을 `Avatar`로. 사진이 바뀌면 바로 따라 바뀐다 |
| 처리방침 | `frontend/src/app/privacy/page.tsx` | 처리 항목·보유 기간·변경 고지 |
| 정리 작업 | `collector/tools/leaflet_queue.py` | 회원 기록이 없는 폴더의 사진, 회원 기록이 가리키지 않는 남은 사진 지우기 |

## 확인 방법

1. 운영 DB 되돌림 시험(한 문장 안에서 적용 → 시험 → 전부 되돌림): 자기 경로는 저장되고 남의 경로·형식이 다른 경로는 거절, 저장소에 자기 폴더는 넣어지고 남의 폴더·익명은 거절, 다른 회원은 내 파일 줄을 못 읽음
2. `tsc --noEmit` + `next build --webpack`, 수집기 테스트
3. 로컬 화면(관리자 계정): 머리 줄과 «내 정보» 원에 까치, «고치기»에 사진 버튼 2개, 폭 375px 가로 넘침 0
4. 배포 뒤 운영: 사진 올리기 → 두 원에 보임 → 새로 불러와도 그대로 → 지우기 → 까치(관리자)로 돌아감
