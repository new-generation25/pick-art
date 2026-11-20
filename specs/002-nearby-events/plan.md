# Implementation Plan: 내 주변 행사 (거리순 보기)

**Branch**: `revive/2026-10` (명세 `specs/002-nearby-events`) | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

## Summary

공개 행사의 장소를 건물 단위 `venues`로 묶고 좌표(KOPIS → 네이버 지역 검색 → 운영자 확인)를 채운다. 사이트에 `/nearby` 화면을 더해, 방문자 위치(허용 시) 또는 고른 지역 중심에서의 **직선거리**를 브라우저 안에서 계산해 가까운 순으로 보여 준다. 위치는 서버·URL·분석 도구로 나가지 않는다. 각 행사에서 네이버지도 대중교통·자동차 길찾기로 넘긴다.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 16.1 (App Router, webpack 빌드), React 19 · Python 3.13(수집기)
**Primary Dependencies**: Mantine 8, Tailwind 4, `@supabase/supabase-js` 2 · 수집기 `requests`, `python-dotenv` (새 의존성 없음)
**Storage**: Supabase Postgres — 새 표 `venues`, `events.venue_id`, 공개 뷰 `public_venues`
**Testing**: `node --test`(순수 함수), `python -m unittest`(정규화·확정 규칙), `npx tsc --noEmit`, 내장 브라우저 미리보기
**Target Platform**: 휴대폰 브라우저 우선(iOS Safari·Android Chrome), PC 브라우저. Vercel(`icn1`)
**Project Type**: 웹앱(frontend) + 로컬 수집기(collector)
**Performance Goals**: 위치 허용 후 첫 목록 3초 안(SC-003). 기간 안 행사 ~700건 브라우저 정렬 < 50ms
**Constraints**: 위치를 서버·URL에 남기지 않음, 비용 0(무료 한도), 네이버 검색 키는 수집기에만, 개발 서버 1개·힙 2GB
**Scale/Scope**: 장소 약 100곳(추정, 200개 표기), 공개 행사 약 700건, 지역 기준점 34곳

## Constitution Check

| 원칙 | 확인 | 결과 |
|---|---|---|
| I 확인한 정보만 | 좌표는 자동 확정 규칙(research §2) 통과 또는 운영자 확인분만 공개. 미확인은 거리 표시 없이 「거리 확인 안 됨」 | 통과 |
| II 작은 무대·브랜드 | 공공·소규모 구분 없이 같은 거리 기준. 날짜가 가장 큰 글자(FR-007). 화면 작업 전 BRAND_GUIDE 읽기를 tasks에 넣음 | 통과 |
| III 보안·비밀값 | 네이버 검색 키(Client ID·Secret)는 `collector/.env`만. `venues` RLS(익명 select, 관리자 쓰기), 공개 뷰로 `candidates` 숨김. 방문자 위치 서버 미전송 | 통과 |
| IV AI 최소 수집 | AI 사용 없음. 공식 API(KOPIS) → 검색 API → 사람 순. 정기 루틴에 숫자 보고 한 줄 | 통과 |
| V 끝 조건 먼저 | quickstart의 4단계 확인(비율·오차·화면 세 경우·실기기)이 끝 조건 | 통과 |

설계 후 재확인: 위반 없음. Complexity Tracking 비움.

## Project Structure

### Documentation
```text
specs/002-nearby-events/
├── spec.md
├── plan.md            # 이 파일
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── nearby-ui.md
│   ├── naver-map-link.md
│   └── venue-geocode.md
└── tasks.md           # /speckit-tasks 에서 만든다
```

### Source Code
```text
supabase/migrations/
└── 20261121000000_venues.sql          # venues, events.venue_id, public_venues, RLS

collector/
├── tools/geocode_venues.py            # 정규화·묶기·좌표·자동 확정·연결
├── venue_norm.py                      # 정규화·확정 규칙(테스트 대상 순수 함수)
├── tests/test_venue_norm.py
└── main.py                            # 정기 루틴 끝에 geocode_venues 호출 + 보고 한 줄

frontend/src/
├── app/nearby/page.tsx                # 서버: 기간 안 행사+좌표 조회
├── app/nearby/NearbyClient.tsx        # 클라이언트: 위치·지역·정렬·필터·목록
├── app/admin/venues/page.tsx          # 확인 대기 장소 처리
├── lib/nearby.ts                      # 하버사인·정렬·필터(순수)
├── lib/naverMap.ts                    # 길찾기 링크(순수)
├── lib/areaCenters.ts                 # 지역 기준점 34곳
├── lib/__tests__/nearby.test.mjs
└── components/ui/FilterBar.tsx        # 「내 주변」 진입 링크 추가
```

**Structure Decision**: 기존 `frontend/`(Next.js)와 `collector/`(파이썬) 두 갈래를 그대로 쓴다. 새 서버 API는 만들지 않는다(서버 컴포넌트에서 Supabase 조회).

## 단계와 끝 조건

| 단계 | 끝 조건(무엇으로 확인) |
|---|---|
| A. 확인 작업 | KOPIS `prfplc` 좌표 칸 유무, 네이버 지역 검색 무료 한도·좌표 형식, 네이버 웹 길찾기 주소 형식을 실제로 확인해 research.md에 기록 |
| B. DB | 마이그레이션 적용 후 익명 키로 `public_venues` select 성공·`venues.candidates` select 거부 |
| C. 좌표 채우기 | quickstart 1: 확정 비율 ≥ 80%, 표본 30곳 오차 ≤ 300m |
| D. 순수 함수 | quickstart 2 통과 |
| E. 화면 | quickstart 3 세 경우 통과, 좌표 노출 0건, tsc 0 |
| F. 관리자 | `pending` 장소 1곳을 화면에서 확정하면 `/nearby`에 거리가 생김 |
| G. 실기기 | quickstart 4(사용자 확인) |

## 사용자가 할 일
- 네이버 클라우드 콘솔 NAVER API HUB에서 「지역 검색」 이용 신청 → Application 등록 → Client ID·Secret → `collector/.env`에 넣기(단계 A 전에 안내).
- 마이그레이션 적용·배포(`main` 병합)는 승인 후.
- 단계 G 실기기 확인.

## Complexity Tracking

없음.
