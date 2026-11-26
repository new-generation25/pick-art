-- specs/015 행사 분류 두 단계 (사용자 결정 2026-11-26, docs/plan/genre_taxonomy_2026-11-26.md)
--   events.subcategory          : 세부 갈래 (대분류별 허용 목록, CHECK)
--   events.subcategory_by       : 누가 정했나 kopis / rule / admin (헌장 IV)
--   events.subcategory_pending  : 규칙으로 못 정해 운영자 검토 대기
--   events.subcategory_evidence : 판정 근거(걸린 낱말·KOPIS 장르 원문)
--   체험·교육 → 체험 (사용자 결정 1): events.category, profiles.interests
--
-- 되돌리기:
--   ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_subcategory_valid;
--   ALTER TABLE public.events DROP COLUMN IF EXISTS subcategory, DROP COLUMN IF EXISTS subcategory_by,
--     DROP COLUMN IF EXISTS subcategory_pending, DROP COLUMN IF EXISTS subcategory_evidence;
--   (체험·교육 → 체험 은 사용자 결정이라 되돌리지 않는다)

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS subcategory text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS subcategory_by text
    CHECK (subcategory_by IS NULL OR subcategory_by IN ('kopis', 'rule', 'admin'));
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS subcategory_pending boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS subcategory_evidence text
    CHECK (subcategory_evidence IS NULL OR char_length(subcategory_evidence) <= 200);

-- 체험·교육 → 체험 (CHECK 보다 먼저)
UPDATE public.events SET category = '체험' WHERE category = '체험·교육';
UPDATE public.profiles
   SET interests = (SELECT array_agg(DISTINCT CASE WHEN x = '체험·교육' THEN '체험' ELSE x END) FROM unnest(interests) AS x)
 WHERE interests @> ARRAY['체험·교육'];

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_subcategory_valid;
ALTER TABLE public.events ADD CONSTRAINT events_subcategory_valid CHECK (
    subcategory IS NULL OR
    (category = '공연' AND subcategory IN ('연극','뮤지컬','클래식·오페라','국악·전통연희','대중음악','무용','서커스·마술','복합·기타')) OR
    (category = '전시' AND subcategory IN ('회화·드로잉','사진','조각·설치','미디어','공예','디자인·건축','서예','역사·박물관','기타')) OR
    (category = '축제' AND subcategory IN ('문화예술축제','지역축제')) OR
    (category = '행사' AND subcategory IN ('강연·북토크','상영회','마켓','기타')) OR
    (category = '체험' AND subcategory IN ('체험·워크숍','교육·강좌'))
);
CREATE INDEX IF NOT EXISTS events_subcategory_idx ON public.events (category, subcategory);
CREATE INDEX IF NOT EXISTS events_subcategory_pending_idx ON public.events (subcategory_pending) WHERE subcategory_pending;
