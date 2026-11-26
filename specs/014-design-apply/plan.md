# Implementation Plan: 확정 디자인(f01) 사이트 적용

**Branch**: `revive/2026-10` (명세 폴더 `specs/014-design-apply`) | **Date**: 2026-11-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-design-apply/spec.md`

## Summary

공개 화면을 확정 시안 f01의 구성·색·글꼴로 바꾼다. 데이터와 순서 코드(`lib/feedOrder.ts`·`lib/supabase.ts`)는 그대로 두고 다음을 한다.

- **테마 교체**: 테마 묶음 `paper`를 더하고 `MainLayout`의 테마 값 하나를 바꾼다(R1).
- **새 화면**: 홈은 날짜 묶음별 좌우 선반으로 바꾼다. 지도 시트, 상세·공간·단체, `/me` 화면을 새로 그린다.
- **글자 포스터**: 포스터 파일의 SHA-256 지문으로 안내 그림을 가려낸다(R3). 공개 화면은 `events.poster_placeholder` 하나만 읽고, 그 행사는 글자 포스터로 그린다.
- **협약 표시**: `orgs`·`venues`에 `partner_since`를 더한다. 운영자가 관리자 화면에서 표시한 곳에만 배지가 보인다(R6).
- **작은 지도 없음**: 상세·공간의 작은 지도는 넣지 않는다(운영자 «그냥 버튼»). 홈 지도는 «지도» 버튼을 누를 때 동적으로 불러온다(R4).

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 16 App Router(React 19), Python 3.13(수집기)

**Primary Dependencies**: Mantine 7, Tailwind 4, lucide-react, Supabase JS, 네이버 지도 JS(지금 `/nearby`에서 씀)

**Storage**: Supabase Postgres(서울). 마이그레이션 1개 `20261127010000_design_apply.sql`, 포스터 저장소 `posters` 버킷(읽기만)

**Testing**: `npx tsc --noEmit`, `next build --webpack`, `node --experimental-strip-types --test`(lib 단위 시험), 내장 브라우저 375×812·1280 확인, quickstart.md 절차

**Target Platform**: 모바일 브라우저(375px 기준)와 PC 브라우저, PWA 설치판

**Project Type**: 웹 앱(Next.js 프론트 + Supabase) + 운영자 PC 파이썬 수집기

**Performance Goals**:
- 홈 첫 화면(FCP·LCP)이 바꾸기 전보다 늦어지지 않는다(SC-007).
- 홈을 열 때 지도 스크립트 요청은 0건이다(SC-002).

**Constraints**:
- 개발 서버는 한 번에 하나만 띄운다(webpack, 힙 2GB). Turbopack은 쓰지 않는다.
- 비밀값은 출력하지 않는다.
- `main` 합치기(배포)는 운영자 승인 뒤에 한다.

**Scale/Scope**:
- 공개 행사 약 1,200건, 공간·단체 약 330곳.
- 바꾸는 화면은 홈(지역 페이지 포함), 모두 보기, 지도 시트, 상세, 공간, 단체, `/me` 7개이고, 나머지 공개 화면은 새 색만 입는다.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 확인 | 결과 |
|---|---|---|
| I. 확인한 정보만 공개 | 글자 포스터에는 DB의 날짜·제목·출처만 넣고 지어낸 문구를 넣지 않는다. 포스터가 없으면 «포스터 없음»을 적는다. «피카가 본 이유»는 사람이 쓴 값만 보인다. 시안의 예시 문장은 넣지 않는다. 협약 배지는 운영자가 표시한 곳만 | 통과 |
| II. 작은 무대를 같은 무게로, 브랜드 가이드 | 색·글꼴은 BRAND_GUIDE 2·3절 «화면 팔레트·글꼴»(3ba5207, 운영자 «앱 화면만 새 색»)을 따른다. 선반 칸은 기관·단체 구분 없이 같은 크기다. «경남»을 브랜드 자리에 쓰지 않는다. 날짜가 가장 큰 글자다(글자 포스터·선반 칸) | 통과 |
| III. 보안과 비밀값 | 새 표 `placeholder_images`는 처음부터 관리자만 읽고 쓰게 만든다(RLS). `venues`는 계속 관리자 전용이고, 공개는 뷰로 `partner_since`만 내보낸다. 지문 채움 도구는 운영자 PC에서만 돌리고 서비스 키를 출력하지 않는다. 배포는 승인 뒤에 한다 | 통과 |
| IV. AI 최소 개입 | 안내 그림은 AI가 아니라 파일 지문으로 가려낸다. 표시는 운영자가 한다. 사실을 만들거나 바꾸지 않는다 | 통과 |
| V. 끝 조건 먼저 | quickstart.md에 10단계 검증과 각 단계의 기대값을 적었다(SC-001~008에 대응) | 통과 |

**Post-design 재확인(Phase 1 뒤)**: data-model의 트리거는 `poster_placeholder`만 고치고 원본 칸(`poster_image_url`)은 건드리지 않는다(I 유지). 지도 동적 import는 III·IV와 관계없다. 위반 없음 → Complexity Tracking 비움.

## Project Structure

### Documentation (this feature)

```text
specs/014-design-apply/
├── spec.md
├── plan.md              # 이 문서
├── research.md          # R1~R8
├── data-model.md        # placeholder_images, events 두 칸, orgs·venues 협약 칸
├── quickstart.md        # 검증 10단계
├── contracts/
│   └── screens.md       # 화면별 필수 요소
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks 에서 만든다
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20261127010000_design_apply.sql      # 새: 안내 그림 표·지문 칸·트리거, 협약 칸, public_venues 다시 만들기

collector/
├── database.py, utils.py                # 고침: 포스터를 올릴 때 poster_sha256 함께 적기
└── tools/poster_fingerprint.py          # 새: 기존 행사 지문 한 번 채우기(--apply 없으면 미리보기만), 후보 보고

frontend/src/
├── app/
│   ├── globals.css                      # 고침: paper 테마 묶음, 선반·시트·글자 포스터 클래스, 핀 색
│   ├── layout.tsx                       # 고침: Gowun Batang·Space Grotesk 링크, themeColor
│   ├── page.tsx, region/[name]/page.tsx # 그대로(HomeFeed 사용)
│   ├── events/[id]/page.tsx             # 고침: 새 순서, 고정 아래 막대
│   ├── venues/[id]/page.tsx, orgs/[id]/page.tsx  # 고침: 협약 배지·여는 곳 데이터 전달
│   ├── me/page.tsx                      # 새: 내 정보 한 화면
│   ├── saved/page.tsx, settings/page.tsx  # 고침: /me#… 로 리디렉트
│   └── admin/…                          # 고침: 안내 그림 표시, 협약 표시 입력(배치 그대로)
├── components/
│   ├── MainLayout.tsx                   # 고침: data-pica-theme="paper"
│   ├── HomeFeed.tsx                     # 고침: 칩 줄 + 선반 + 상시 접기 + 지도 버튼
│   ├── PlacePage.tsx                    # 고침: 새 공간·단체 구성
│   └── ui/
│       ├── Header.tsx                   # 고침: 로고·찾기·내 정보
│       ├── Shelf.tsx                    # 새: 날짜 묶음 선반(머리 + 좌우 칸)
│       ├── PosterOrText.tsx             # 새: 포스터 또는 글자 포스터
│       ├── MapSheet.tsx                 # 새: 지도 시트(동적 import로 NearbyMap 사용)
│       ├── FilterBar.tsx, FeedSections.tsx, EventCard.tsx, EventList.tsx  # 고침: 새 모양(필터 동작·순서 그대로)
│       └── StickyActions.tsx            # 새: 상세 아래 고정 막대
└── lib/
    ├── posters.ts                       # 새: 글자 포스터 판단(placeholder·빈 주소) + 시험
    └── __tests__/posters.test.mjs       # 새
```

**Structure Decision**: 지금 저장소 구조(프론트 `frontend/src`, DB `supabase/migrations`, 수집기 `collector`)를 그대로 쓴다. 새 파일은 위에 적은 것만 만든다. 리소 테마 값은 `globals.css`에 보관용으로 남긴다.

## 구현 순서 (tasks 단계에서 쪼갠다)

각 단계마다 커밋한다. 각 단계는 아래 기준을 확인하면 끝이다.

| 단계 | 내용 | 끝 기준 |
|---|---|---|
| 1 | 마이그레이션 + 지문 채움 도구(미리보기 → 운영자 확인 없이 적용 가능: 칸 채우기만, 공개 상태 변경 없음) | `poster_placeholder=true` 행사 수 보고, 처음 표시한 지문의 행사 전부 true |
| 2 | 테마 `paper`·글꼴·`PosterOrText` | quickstart 1·2·9 |
| 3 | 홈 선반·칩 줄·상시 접기·모두 보기 | quickstart 3·4 |
| 4 | 지도 시트 | quickstart 5 |
| 5 | 상세 | quickstart 7(상세 칸) |
| 6 | 공간·단체 + 협약 표시 관리자 입력 | quickstart 8 |
| 7 | `/me` + 리디렉트 | quickstart 7(주소) |
| 8 | 관리자 안내 그림 표시·후보 | quickstart 6 |
| 9 | 전체 검증·보고 | quickstart 1~10 전부, 운영자에게 배포 승인 요청 |

## Complexity Tracking

> 위반 없음.
