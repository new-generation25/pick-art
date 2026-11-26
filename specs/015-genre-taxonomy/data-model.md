# Data Model: 행사 분류 두 단계

## events 에 더하는 칸

| 칸 | 형 | 규칙 |
|---|---|---|
| `subcategory` | text NULL | 분류표에서 그 `category`에 속한 값만(CHECK) |
| `subcategory_by` | text NULL | `kopis` · `rule` · `admin` |
| `subcategory_pending` | boolean NOT NULL DEFAULT false | 규칙으로 못 정해 운영자 검토 대기 |
| `subcategory_evidence` | text NULL | 판정 근거(걸린 낱말·KOPIS 장르 원문), ≤200자 |

**CHECK** `events_subcategory_valid`
- `subcategory`가 NULL이거나, `category`에 맞는 목록 안의 값이어야 한다.
  - 공연: 연극, 뮤지컬, 클래식·오페라, 국악·전통연희, 대중음악, 무용, 서커스·마술, 복합·기타
  - 전시: 회화·드로잉, 사진, 조각·설치, 미디어, 공예, 디자인·건축, 서예, 역사·박물관, 기타
  - 축제: 문화예술축제, 지역축제
  - 행사: 강연·북토크, 상영회, 마켓, 기타
  - 체험: 체험·워크숍, 교육·강좌
- `관광` 등 다른 대분류는 세부 NULL만 허용한다.

**상태**
- 미판정: `subcategory` NULL, `pending` false
- 확정: 도구가 `kopis`/`rule`로 확정하면 `subcategory`가 채워지고 `pending` false
- 대기: 도구가 못 정하면 `subcategory` NULL, `pending` true
- 운영자 확정: 운영자가 고르면 `admin`, `pending` false. 도구는 `admin` 행을 건너뛴다.

## 같은 마이그레이션의 데이터 정리

- `UPDATE events SET category='체험' WHERE category='체험·교육'`
- `profiles.interests`의 '체험·교육'을 '체험'으로 바꾸고 중복을 없앤다.
- `raw_posts.content.ai_suggestion.category`는 고치지 않는다(원문 보존). 공개할 때 `normalize_category`가 바꾼다.

## 되돌리기

```sql
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_subcategory_valid;
ALTER TABLE public.events DROP COLUMN subcategory, DROP COLUMN subcategory_by, DROP COLUMN subcategory_pending, DROP COLUMN subcategory_evidence;
-- 체험·교육 → 체험 은 되돌리지 않는다(사용자 결정 1)
```
