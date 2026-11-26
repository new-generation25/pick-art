# Data Model: 확정 디자인(f01) 사이트 적용

기존 표(`events`·`venues`·`orgs`·`event_orgs`·`favorites`·`profiles`)는 그대로 쓴다. 아래 칸과 표만 더한다. 마이그레이션 이름은 `supabase/migrations/20261127010000_design_apply.sql`로 한다(가장 최근 마이그레이션이 `20261127000000`).

## 1. 안내 그림

### `placeholder_images` (새 표)

| 칸 | 형 | 규칙 |
|---|---|---|
| `sha256` | text PK | 64자리 소문자 16진수 |
| `bytes` | integer | 파일 크기(참고용) |
| `note` | text | 예: 「김해서부문화센터 "공연 이미지 준비 중"」 (≤120자) |
| `marked_by` | uuid | 표시한 관리자 (`auth.users`) |
| `marked_at` | timestamptz | 기본 now() |

- RLS: 읽기·쓰기는 관리자만(`public.is_admin()`). 공개 화면은 이 표를 직접 읽지 않는다.

### `events` 에 더하는 칸

| 칸 | 형 | 규칙 |
|---|---|---|
| `poster_sha256` | text NULL | 포스터 파일의 지문. 포스터가 없으면 NULL |
| `poster_placeholder` | boolean NOT NULL DEFAULT false | `poster_sha256`이 `placeholder_images`에 있으면 true |

- `poster_placeholder`는 DB가 맞춘다. 맞추는 경우는 두 가지다.
  - `events`에 지문이 들어오거나 바뀌면 그 행을 다시 계산한다(트리거).
  - `placeholder_images`에 행이 더해지거나 빠지면 같은 지문을 쓰는 행사를 한꺼번에 고친다(트리거).
- 공개 화면은 `poster_placeholder`가 true이거나 `poster_image_url`이 비었으면 글자 포스터를 그린다.

**상태 변화**
```
지문 없음 ──(수집·채움 도구가 지문 적음)──▶ 지문 있음, 안내 그림 아님
지문 있음 ──(관리자가 그 지문을 «안내 그림»으로 표시)──▶ poster_placeholder = true (같은 지문 전부)
poster_placeholder = true ──(관리자가 표시 풀기)──▶ false (같은 지문 전부)
```

## 2. 협약

### `orgs` 에 더하는 칸

| 칸 | 형 | 규칙 |
|---|---|---|
| `partner_since` | date NULL | 협약을 맺은 날. NULL이면 협약 아님 |
| `partner_note` | text NULL | ≤200자. 해지하면 「YYYY-MM-DD 해지」를 덧붙인다 |

- `orgs`는 지금도 공개 읽기다. 공개 화면은 `partner_since`가 있는지만 쓴다.

### `venues` 에 더하는 칸 (같은 두 칸)

- `public_venues` 뷰는 지금 칸(`id, name, region, lat, lng, closed_days, capacity, district`) 뒤에 `partner_since`를 붙여 다시 만든다. `partner_note`는 내보내지 않는다.

**검증 규칙**: `partner_since`는 오늘보다 미래일 수 없다(CHECK `partner_since <= (now() AT TIME ZONE 'Asia/Seoul')::date + 1`).

## 3. 되돌리기

```sql
DROP TRIGGER … ; DROP FUNCTION … ;
ALTER TABLE public.events DROP COLUMN poster_placeholder, DROP COLUMN poster_sha256;
DROP TABLE public.placeholder_images;
ALTER TABLE public.orgs DROP COLUMN partner_since, DROP COLUMN partner_note;
-- public_venues 를 여덟 칸으로 다시 만든 뒤
ALTER TABLE public.venues DROP COLUMN partner_since, DROP COLUMN partner_note;
```
마이그레이션 파일 머리에 이 되돌리기를 그대로 적는다(지금까지의 마이그레이션 관례).
