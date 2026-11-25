# Feature Specification: 지역 고정 주소 (검색 노출용)

**Feature Branch**: `revive/2026-10` (명세 `specs/010-region-pages`) | **Created**: 2026-11-26 | **Status**: 구현·로컬 검증 완료. 운영자 11/26 «배포해»·«부산 구 단위 페이지도 진행해. 지역명을 영어로해»(SNS콘텐츠 세션에서 입력, 이 세션이 기록 확인)

**Input**: SNS콘텐츠 세션 요청(운영자 11/26 「응 넘겨」). 홍보 벤치마킹 [docs/plan/promo_bench_similar_2026-11-26.md](../../docs/plan/promo_bench_similar_2026-11-26.md) 1번 — 지역 페이지가 검색 첫 쪽에 잡히는 사례. 11/26 picka.news 실측: `/?region=김해`의 제목·canonical이 홈과 같아 검색엔진이 같은 페이지로 봄, sitemap에 지역 페이지 없음.

## 요구사항

- FR-001 지역마다 고정 주소 `/region/<이름>`(경남 18개 시군 + 부산 = 19). 화면은 홈 목록에 지역을 고정한 것(`components/HomeFeed.tsx` 공용). 제목은 「김해에서 열리는 공연·전시·축제」.
- FR-002 `<title>` 「김해 공연·전시·축제 70건 · 이번 주 31건 | 피카 pica」, description에 기준 날짜·건수. 건수는 서버에서 공개 목록과 같은 조건으로 센다. og·twitter 같은 문구.
- FR-003 canonical·og:url은 그 페이지 자신. 옛 주소 `/?region=김해&…`는 308로 `/region/김해?…`로 넘긴다. `/?region=전체`(자동 지역 적용을 끈 선택)는 홈에 남는다. 목록에 없는 지역은 404.
- FR-004 sitemap.xml에 행사가 있는 지역만 추가(changefreq daily, priority 0.8). robots는 모든 로봇 허용(네이버 Yeti 포함), `/region` 막지 않음.
- FR-005 지역 칩을 누르면 주소 경로가 바뀐다(공유한 링크가 곧 지역 주소). 다른 조건은 `?` 뒤에 남고, 지역 「전체」는 홈으로. 검색창은 지금 주소(지역) 안에서 찾는다. 로그인 회원의 «내 지역 자동 적용»은 홈(`/`)에서만 지역 주소로 보낸다.
- 브랜드: 지역은 시군 이름으로만, 「경남」을 브랜드 문구로 쓰지 않는다(가이드 1절 지역 표기 규칙).

## 검증 (2026-11-26, 로컬 `next start`)

- `/region/김해`: title «김해 공연·전시·축제 70건 · 이번 주 31건 | 피카 pica», canonical·og:url `…/region/%EA%B9%80%ED%95%B4`, h1 «김해에서 열리는 / 공연·전시·축제»
- `/?region=김해&category=공연` → 308 `/region/김해?category=공연` · `/?region=전체` 200 · `/region/xx` 404
- sitemap.xml에 `/region/` 19건 · robots.txt `User-Agent: * / Allow: /`
- 홈에서 김해 칩 → 주소 `/region/김해` · 공연 칩 → `/region/김해?category=공연` · 지역 전체 → `/?category=공연`, 홈 제목으로 돌아옴
- 로컬은 SITE_URL 기본값(pick-art.vercel.app)으로 찍힘. 배포 뒤 picka.news로 찍히는지 curl로 다시 본다.

## 바뀐 것 (11/26 운영자 지시 «지역명을 영어로해», «부산 구 단위 페이지도 진행해»)

- 주소는 국어의 로마자 표기법 소문자: `/region/gimhae`, 부산 구·군은 `/region/busan/haeundae`(`lib/regions.ts` REGION_SLUGS·BUSAN_DISTRICTS). 화면·제목 글자는 한글. 한글 주소(`/region/김해`, `/region/busan/해운대구`)·대문자·옛 `/?region=김해`는 308로 로마자 주소.
- 부산 구·군: `venues.district`(마이그레이션 20261126050000, 적용함)를 장소 주소에서 가름 — 부산 장소 82곳 중 77곳(근거 `collector/review/venue_district_2026-11-26.json`). 공개 부산 행사 327건 중 315건이 구에 이어진다. 장소를 모르는 행사는 «부산» 페이지에만 나온다. 부산을 고르면 «구·군» 칩 줄이 생긴다.
- 행사가 0건인 구·군(서구·연제구)은 `noindex`, sitemap에서 뺀다.

## 검증 2 (로컬 `next start`, 11/26)

- `/region/gimhae` «김해 … 70건 · 이번 주 31건», `/region/busan` «부산 … 327건 · 이번 주 103건», `/region/busan/haeundae` «부산 해운대구 … 67건 · 이번 주 20건», canonical 각자
- `/region/김해`·`/region/GIMHAE`·`/?region=김해&category=공연`·`/region/busan/해운대구` → 308 로마자 주소(조건 유지) · `/region/seoul`·`/region/gimhae/haeundae`·`/region/busan/xx` 404 · `/region/busan/seo` noindex
- sitemap 지역 33건(19 + 부산 구·군 14)
- 홈 → 부산 칩 → `/region/busan?category=공연`, 구·군 줄 17칩 → 해운대구 → `/region/busan/haeundae?category=공연`, 목록 장소가 모두 해운대구
- `src/lib/__tests__/regions.test.mjs` 3개 통과

## 하지 않은 것

- 경남 시군 안의 읍·면·동 단위 페이지. 장소 주소가 없는 부산 장소 5곳(공간소극장 등)의 구는 비어 있다.
