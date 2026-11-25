# Feature Specification: 지역 고정 주소 (검색 노출용)

**Feature Branch**: `revive/2026-10` (명세 `specs/010-region-pages`) | **Created**: 2026-11-26 | **Status**: 구현·로컬 검증 완료, 배포는 운영자 확인 뒤

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

## 하지 않은 것

- 부산 16개 구·군 페이지: 공개 행사의 장소 글자에 구 이름이 있는 것은 부산 활성 327건 중 10건뿐이고, 장소 주소(`venues.address`)는 공개 뷰에 없다. 구 단위를 하려면 장소에 구를 저장하는 칸(예: `venues.district`, 공개 뷰에 추가)이 필요하다 — 스키마 변경이라 운영자 승인 뒤.
