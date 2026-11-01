-- 끝난 행사 관리
--   종료 후 1개월까지: 공개 피드에서 "종료" 표시, 맨 뒤, 사용자가 켜야 보인다 (프론트에서 처리)
--   종료 후 1~3개월: 공개 피드에서 숨긴다 (프론트에서 처리)
--   종료 후 3개월 초과: 삭제 후보. 관리자 "저장공간" 화면이 용량을 보여 주고, 관리자가 확인하면 지운다
-- 날짜는 'YYYY-MM-DD' 텍스트라 문자열 비교로 충분하다. 빈 문자열은 날짜 없음으로 본다.

-- 삭제 후보: 종료 3개월이 지난 공개 행사 + 그 원본, 그리고 공개된 적 없이 종료 3개월이 지난 원본
CREATE OR REPLACE FUNCTION public.ended_purge_set()
RETURNS TABLE (kind text, id uuid, title text, date_end text, urls text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
WITH cut AS (
    SELECT to_char((now() AT TIME ZONE 'Asia/Seoul')::date - interval '3 months', 'YYYY-MM-DD') AS d
),
ev AS (
    SELECT e.* FROM public.events e, cut
    WHERE NULLIF(e.event_date_end, '') < cut.d
),
raw AS (
    SELECT r.* FROM public.raw_posts r, cut
    WHERE r.status <> 'PURGED'
      AND (
        r.id IN (SELECT raw_post_id FROM ev WHERE raw_post_id IS NOT NULL)
        OR (
          NULLIF(r.content->'ai_suggestion'->>'date_end', '') < cut.d
          AND NOT EXISTS (SELECT 1 FROM public.events k WHERE k.raw_post_id = r.id AND k.id NOT IN (SELECT ev.id FROM ev))
        )
      )
)
SELECT 'event', ev.id, ev.title, ev.event_date_end, ARRAY_REMOVE(ARRAY[ev.poster_image_url], NULL) FROM ev
UNION ALL
SELECT 'raw_post', raw.id, raw.content->>'title', raw.content->'ai_suggestion'->>'date_end', COALESCE(raw.image_urls, '{}') FROM raw;
$$;

-- 삭제 후보 중 우리 Storage 에 있고, 남는 행사·원본 어디에서도 쓰지 않는 파일
CREATE OR REPLACE FUNCTION public.ended_purge_files()
RETURNS TABLE (bucket text, name text, bytes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $$
WITH s AS (SELECT * FROM public.ended_purge_set()),
cand AS (SELECT DISTINCT unnest(urls) AS url FROM s),
kept AS (
    SELECT poster_image_url AS url FROM public.events
    WHERE poster_image_url IS NOT NULL AND id NOT IN (SELECT s.id FROM s WHERE s.kind = 'event')
    UNION
    SELECT unnest(image_urls) FROM public.raw_posts
    WHERE id NOT IN (SELECT s.id FROM s WHERE s.kind = 'raw_post')
)
SELECT o.bucket_id, o.name, COALESCE((o.metadata->>'size')::bigint, 0)
FROM storage.objects o
WHERE EXISTS (SELECT 1 FROM cand WHERE cand.url LIKE '%/object/public/' || o.bucket_id || '/' || o.name)
  AND NOT EXISTS (SELECT 1 FROM kept WHERE kept.url LIKE '%/object/public/' || o.bucket_id || '/' || o.name);
$$;

-- 관리자 화면용 보고서
CREATE OR REPLACE FUNCTION public.ended_events_report()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
WITH d AS (
    SELECT to_char((now() AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS today,
           to_char((now() AT TIME ZONE 'Asia/Seoul')::date - interval '1 month', 'YYYY-MM-DD') AS m1,
           to_char((now() AT TIME ZONE 'Asia/Seoul')::date - interval '3 months', 'YYYY-MM-DD') AS m3
),
pub AS (SELECT NULLIF(event_date_end, '') AS e FROM public.events WHERE status = 'PUBLISHED'),
s AS (SELECT * FROM public.ended_purge_set()),
f AS (SELECT * FROM public.ended_purge_files())
SELECT json_build_object(
    'today', d.today, 'cut_1m', d.m1, 'cut_3m', d.m3,
    'ongoing', (SELECT count(*) FROM pub WHERE e >= d.today OR e IS NULL),
    'ended_recent', (SELECT count(*) FROM pub WHERE e < d.today AND e >= d.m1),
    'ended_hidden', (SELECT count(*) FROM pub WHERE e < d.m1 AND e >= d.m3),
    'purge_events', (SELECT count(*) FROM s WHERE kind = 'event'),
    'purge_raw_posts', (SELECT count(*) FROM s WHERE kind = 'raw_post'),
    'purge_files', (SELECT count(*) FROM f),
    'purge_bytes', (SELECT COALESCE(sum(bytes), 0) FROM f),
    'items', (
        SELECT COALESCE(json_agg(x ORDER BY x.date_end), '[]'::json) FROM (
            SELECT kind, id, title, date_end FROM s ORDER BY date_end LIMIT 200
        ) x
    )
)
FROM d;
$$;

-- 관리자만: 삭제 후보의 공개 행사를 지우고, 원본은 중복 수집을 막는 표시(PURGED)만 남긴다.
-- Storage 파일은 SQL로 지울 수 없어서, 지울 파일 목록을 돌려주고 화면이 Storage API로 지운다.
CREATE OR REPLACE FUNCTION public.purge_ended_events()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    files json;
    n_events int;
    n_raw int;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION '관리자만 삭제할 수 있습니다';
    END IF;

    SELECT COALESCE(json_agg(json_build_object('bucket', bucket, 'name', name, 'bytes', bytes)), '[]'::json)
      INTO files FROM public.ended_purge_files();

    CREATE TEMP TABLE _purge ON COMMIT DROP AS SELECT * FROM public.ended_purge_set();

    DELETE FROM public.events WHERE id IN (SELECT id FROM _purge WHERE kind = 'event');
    GET DIAGNOSTICS n_events = ROW_COUNT;

    UPDATE public.raw_posts r
       SET status = 'PURGED',
           image_urls = '{}',
           content = jsonb_build_object(
               'title', r.content->>'title',
               'ai_suggestion', jsonb_build_object('date_end', r.content->'ai_suggestion'->>'date_end'))
     WHERE id IN (SELECT id FROM _purge WHERE kind = 'raw_post');
    GET DIAGNOSTICS n_raw = ROW_COUNT;

    RETURN json_build_object('events', n_events, 'raw_posts', n_raw, 'files', files);
END;
$$;

REVOKE ALL ON FUNCTION public.ended_purge_set() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.ended_purge_files() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ended_events_report() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_ended_events() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purge_ended_events() TO authenticated;

-- 관리자만 수집 이미지를 지울 수 있다
DROP POLICY IF EXISTS "Admin delete pick-art images" ON storage.objects;
CREATE POLICY "Admin delete pick-art images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id IN ('posters', 'event-images')
           AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
