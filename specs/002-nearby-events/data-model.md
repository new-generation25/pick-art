# Data Model: 내 주변 행사

## venues (새 표)

| 칸 | 형식 | 설명 |
|---|---|---|
| id | uuid PK | |
| name | text, not null | 정규화한 건물 단위 이름(예: `해운대문화회관`) |
| aliases | text[] | 원래 표기들(예: `해운대문화회관 (고운홀)`, `해운대문화회관 해운홀`). 새 행사 매칭에 쓴다 |
| region | text | 시군(기존 `GN_REGIONS` 값) |
| address | text | 도로명 주소(확인된 것만) |
| lat, lng | double precision, null 가능 | WGS84. `geo_status='confirmed'`일 때만 공개 화면이 쓴다 |
| geo_status | text check in (`pending`,`confirmed`,`failed`) | 기본 `pending`. `failed` = 찾을 수 없음(온라인·장소 미정 포함) |
| geo_source | text check in (`kopis`,`naver`,`manual`) | 좌표 출처 |
| candidates | jsonb | 자동 확정 못 한 경우 네이버 지역 검색 후보 최대 3개 `[{name,address,lat,lng}]` |
| checked_by | text | `auto` 또는 확인한 관리자 이메일 |
| checked_at | timestamptz | |
| created_at | timestamptz default now() | |

- 유일성: `(name, region)` unique.
- 상태 전이: `pending` → `confirmed`(자동 확정 규칙 통과 또는 관리자 확인) / `failed`(관리자 판단 또는 검색 결과 없음). `confirmed` → `pending`(관리자가 「다시 확인」).

## events (기존 표에 칸 추가)

| 칸 | 형식 | 설명 |
|---|---|---|
| venue_id | uuid null, FK → venues(id) on delete set null | 연결된 장소. 비어 있으면 「거리 확인 안 됨」 묶음 |

- 기존 `venue`(글자)·`region`은 그대로 둔다(표시용·이전 데이터 호환).
- 한 행사 여러 장소(spec Edge Case)는 현재 데이터에서 별도 행사로 들어오므로 이번 범위에서는 `venue_id` 하나로 둔다. 실제로 묶인 행사가 나오면 `event_venues` 연결표로 확장한다(tasks에서 확인 후 판단).

## 보안 정책 (RLS)

- `venues`: 익명·회원은 **select만**, 그것도 `geo_status='confirmed'`인 행의 `id,name,region,lat,lng`만 쓰면 된다(뷰 또는 컬럼 제한 없이 행 조건으로 충분). `candidates`·`checked_by`가 공개되지 않게 공개용 뷰 `public_venues(id,name,region,lat,lng)`를 둔다.
- 쓰기(insert/update/delete)는 `profiles.role='admin'`과 서비스 키(수집기)만.
- `events.venue_id` 갱신도 기존 관리자 쓰기 정책을 따른다.

## 방문자 기기 안에만 있는 값 (서버 저장 없음)

| 값 | 저장 위치 | 설명 |
|---|---|---|
| 현재 위치 | 메모리(페이지 상태) | 거리 계산 후 저장하지 않음 |
| 고른 지역 | localStorage `pica.nearby.area` | 예: `부산 수영구`. 다음 방문 기본값 |
| 거리·기간·분야 선택 | URL 쿼리(`?r=10&p=week&c=공연`) | 공유 가능. **좌표는 URL에 넣지 않는다** |

## 지역 기준점 (정적 데이터)

`frontend/src/lib/areaCenters.ts`: `{ key: "부산 수영구", label: "수영구", city: "부산", lat, lng, source: "수영구청" }` × (경남 18 + 부산 16).
