# Feature Specification: 찜 · 내 캘린더에 추가 · 캘린더 구독

**Feature Branch**: `revive/2026-10` (명세 `specs/008-saved-calendar`) | **Created**: 2026-11-26 | **Status**: 구현·검증 완료

**Input**: 운영자(11/26) "즐겨찾기 일정 등록하기", 벤치마킹(CalDiscovery — 가입 없이 지역·분야 캘린더 구독). 묶음: [docs/plan/benchmark_features_2026-11-26.md](../../docs/plan/benchmark_features_2026-11-26.md)

## User Stories

1. **찜 (P1)** — 행사 상세의 하트로 찜, 머리말 메뉴 «찜한 행사»(`/saved`)에서 모아 봄(가까운 날짜 순, 끝난 행사는 뒤). 로그아웃이면 로그인 뒤 그 행사로 돌아옴.
2. **내 캘린더에 추가 (P1)** — 상세의 «내 캘린더에 추가: 구글 · 애플·기타(.ics)». 하루 종일 일정(시각은 원문 글이라 설명에), 피카 상세 주소 포함.
3. **캘린더 구독 (P2)** — `/calendar`에서 지역·분야를 고르면 구독 주소(`/calendar.ics?region=&category=`), «구글 캘린더에 구독», «애플·기타(webcal)». 오늘부터 60일, 가입 없음. 꼬리말 «캘린더로 받아 보기».

## Requirements

- FR-001 표 `favorites(user_id, event_id, created_at)` — 자기 것만 읽기·넣기·빼기(RLS). 행사가 지워지면 함께 지워짐.
- FR-002 .ics는 RFC 5545: CRLF, 75바이트 접기, TEXT 이스케이프, 하루 종일(끝 = 다음 날), UID `<id>@picka.news`, 구독 달력은 REFRESH-INTERVAL 12시간.
- FR-003 날짜 없는 행사는 캘린더에 넣지 않는다(추측하지 않음, 헌장 I). 숨김 분야(관광)·비공개 행사 제외.
- FR-004 잘못된 지역·분야 값은 400.

## 검증 (2026-11-26)

- 단위 테스트 7개(`src/lib/__tests__/ics.test.mjs`): 끝 날짜, 여러 날, 날짜 없음, 이스케이프, 한글 75바이트 접기, 달력 모양, 구글 링크
- 로컬 빌드: `/events/<id>/ics` 200 `text/calendar` 첨부, `DTSTART;VALUE=DATE:20261128 / DTEND 20261129`. `/calendar.ics?region=김해&category=전시` 200, VEVENT 20건. `region=xx` → 400
- 회원(socialceos): 하트 → `aria-pressed=true`, `/saved`에 1건 → 다시 눌러 해제(`false`)
- 익명: `favorites` 읽기 `[]`
- `/calendar`: 김해 고르면 구독 주소·구글·webcal 링크가 바뀜
- `icalendar` 파이썬 파서는 이 PC에 없어 외부 파서 검증은 못 함(단위 테스트로 대신)

## 남은 것

- 구글 캘린더가 구독 주소를 실제로 받아 오는지는 배포 주소로 운영자 계정에서 한 번 눌러 봐야 확인된다.
