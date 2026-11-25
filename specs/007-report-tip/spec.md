# Feature Specification: 오류 신고·행사 제보

**Feature Branch**: `revive/2026-10` (명세 `specs/007-report-tip`) | **Created**: 2026-11-26 | **Status**: 구현·검증 완료(배포는 아래)

**Input**: 운영자(11/26) "오류신고, 제보하기는 일단 추가하고", 벤치마킹(Songkick «Flag a problem», 공다방 «버스킹·팝업 제보»). 결정: **구글·카카오 로그인 회원만** 보낸다. 원칙: 확인한 정보만 공개(헌장 I) → 관리자 검수 뒤 반영.

## User Stories

1. **정보가 틀렸어요 (P1)** — 행사 상세 아래 «정보가 틀렸어요» → 틀린 곳(날짜·시간 / 장소 / 관람료 / 링크 / 취소·변경 / 포스터 / 기타) 고르고 한 줄 → «알리기». 로그아웃이면 «로그인하고 알리기»(로그인 뒤 그 상세로 돌아옴).
2. **행사 제보하기 (P1)** — 꼬리말 «행사 제보하기» → `/tip`: 행사 이름·시작(끝)날짜·장소·지역·공식 안내 주소(필수)·더 알려 줄 것. 공식 안내 주소가 없으면 받지 않는다(확인할 근거).
3. **관리자 처리 (P1)** — `/admin/reports`: 새로 온 것 / 전체, 신고는 행사 링크, 제보는 날짜·장소·안내 주소. «반영함 / 반영 안 함 / 다시 열기», 관리자 메모. 제보 반영은 «직접 등록»(/admin/manual)으로 — 자동 공개하지 않는다. 운영 대시보드 «사람 판단 대기»에 «신고·제보» 칸, «살펴볼 것»에 대기 건수.

## Requirements

- FR-001 표 `reports`(kind error/tip, event_id, user_id, category, body, tip jsonb, status new/done/rejected, admin_note, 시각). RLS: 회원은 자기 것만 넣고(하루 10건) 읽음, 관리자는 모두 읽고 처리, 익명은 아무것도 못 함.
- FR-002 로그인 뒤 원래 자리로(`/login?next=…` → `/auth/callback?next=…`, 같은 사이트 경로만).
- FR-003 개인정보처리방침에 수집 항목·보유 기간 추가.
- FR-004 카카오 로그인은 Supabase 카카오 공급자를 켜고 `NEXT_PUBLIC_KAKAO_LOGIN=on`이면 같은 버튼으로 바로 쓰인다(운영자 계정 작업).

## 검증 (2026-11-26, 로컬 빌드 + 운영 DB)

- 익명: `reports` 읽기 `[]`, 쓰기 401(RLS) — REST로 확인
- 로그아웃 화면: «로그인하고 알리기»가 `/login?next=%2Fevents%2F…`, `/tip`은 «로그인하고 제보하기» `/login?next=%2Ftip`
- 회원(socialceos, role=user): 신고 보내기 → «고맙습니다…», 제보 보내기 → «제보를 받았어요»
- 관리자(pick.art.pica): `/admin/reports`에 두 건, 메모 + «반영 안 함» → DB `status=rejected, admin_note=앱 개선 세션 시험`
- 시험 중 발견·수정: 제보 양식·관리자 메모 칸이 입력하자마자 오류 화면(상태 갱신 함수 안에서 `e.currentTarget`을 읽음) → 값을 먼저 읽도록 고침

## 남은 것

- 카카오 로그인 켜기(운영자): Kakao Developers 앱의 REST API 키·Client Secret을 Supabase Auth › Providers › Kakao에 넣고, Vercel 환경 변수 `NEXT_PUBLIC_KAKAO_LOGIN=on`.
- 반영한 제보를 «직접 등록» 화면에 자동으로 채워 넣기(지금은 링크만).
