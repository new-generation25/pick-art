# Contract: 장소 좌표 채우기 (`collector/tools/geocode_venues.py`)

## 실행
- `python tools/geocode_venues.py --backfill` : 공개 중인 모든 행사의 장소를 `venues`로 묶고 좌표를 채운다(1회).
- `python tools/geocode_venues.py` : `venue_id`가 빈 공개 행사만 처리. 정기 루틴(04:00·18:00) 끝에 붙인다.
- `--dry-run` : DB에 쓰지 않고 묶음·판정 결과만 출력.

## 처리
1. 장소 이름 정규화: 특수 공백(`\xa0`) → 공백, 괄호·대괄호 안 내용 제거, 끝의 관 이름(대극장·중극장·소극장·○○홀·전시실·제n전시장 등) 제거, 연속 공백 정리.
2. `(정규화 이름, region)`으로 기존 `venues` 또는 `aliases`에서 찾고, 없으면 새 `venues` 행(`pending`).
3. 좌표: KOPIS 출처면 시설 좌표 → 아니면 네이버 지역 검색 API(`{정규화 이름} {region}`, 결과 최대 5개) → 결과가 없으면 주소로 다시 검색.
4. research §2 자동 확정 규칙 통과 → `confirmed`, `geo_source`, `checked_by='auto'`. 아니면 `pending` + `candidates`.
5. `events.venue_id` 연결.

## 출력(보고)
`장소 n곳(새 n) · 자동 확정 n · 확인 대기 n · 실패 n · 연결한 행사 n` — 정기 루틴 완료 알림에 이 한 줄을 붙인다(헌장 IV: 숫자로 보고).

## 관리자 화면 `/admin/venues`
- 목록: `pending` 먼저, 장소명·별칭·시군·연결 행사 수·후보.
- 동작: 후보 고르기 → `confirmed`(manual), 좌표 직접 붙여넣기(`35.1,129.0`), 「찾을 수 없음」 → `failed`, 두 장소 합치기(별칭 이동·행사 재연결).
- 모든 변경에 `checked_by`(관리자 이메일)·`checked_at` 기록.
