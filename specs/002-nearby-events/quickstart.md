# Quickstart: 내 주변 행사 검증

## 준비
- `collector/.env`에 `NAVER_SEARCH_CLIENT_ID`·`NAVER_SEARCH_CLIENT_SECRET`(사용자가 발급). 프런트에는 넣지 않는다.
- 마이그레이션 적용: `supabase db push` (venues 표, events.venue_id, public_venues 뷰, RLS).

## 1. 좌표 채우기
```
cd collector
PYTHONIOENCODING=utf-8 python tools/geocode_venues.py --backfill --dry-run
PYTHONIOENCODING=utf-8 python tools/geocode_venues.py --backfill
```
- 기대: 보고 한 줄. 공개 행사 중 `venue_id`가 연결되고 장소가 `confirmed`인 비율 ≥ 80%(SC-001).
- 표본 30곳: 표시 좌표와 네이버지도에서 찾은 위치 차이가 모두 300m 이내(SC-002). 결과를 `docs/REPORT_nearby_geocode.md`에 표로 남긴다.

## 2. 순수 함수 테스트
```
cd frontend
node --test src/lib/__tests__/nearby.test.mjs
```
- 거리(서울역↔부산역 등 알려진 거리 ±1%), 정렬(거리 → 날짜), 필터(3km·주말), 네이버 링크 4경우.

## 3. 화면 (내장 브라우저 미리보기, 개발 서버는 사용자 승인 후 1개만)
- `npx tsc --noEmit` 오류 0.
- `/nearby`에서 `navigator.geolocation`을 스크립트로 대체해 세 경우 확인:
  - 허용(광안리 좌표): 목록 거리 오름차순, 첫 항목 거리가 가장 작음, 「내 위치 기준」.
  - 거부: 지역 고르기 표시 → 「부산 수영구」 선택 → 「수영구 중심 기준」, 새로고침 후에도 선택 유지.
  - 7초 지연: 6초 뒤 지역 고르기로 전환.
- 네트워크 요청·URL에 위도·경도가 없는지 확인(SC-005): `read_network_requests`에서 좌표 숫자 검색 0건.
- 모바일 폭(375px)에서 가로 스크롤 없음, 날짜가 가장 큰 글자.

## 4. 네이버지도 실기기
- 아이폰·안드로이드에서 「대중교통 길찾기」 「자동차 길찾기」 각각 눌러 네이버지도 길찾기 화면이 도착지가 채워진 채로 열리는지(사용자 확인 필요, 실기기).
