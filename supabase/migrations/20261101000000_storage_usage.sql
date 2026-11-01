-- 관리자 "저장공간" 화면용: Storage 버킷·DB 용량, 어디에도 쓰이지 않는 이미지, 큰 파일 목록을 한 번에 돌려준다.
-- storage.objects 와 pg 통계는 anon 이 직접 읽을 수 없어서 SECURITY DEFINER 로 감싼다. 읽기만 하고 아무것도 바꾸지 않는다.
CREATE OR REPLACE FUNCTION public.storage_usage()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $$
WITH objs AS (
    SELECT o.bucket_id,
           o.name,
           o.created_at,
           COALESCE((o.metadata->>'size')::bigint, 0) AS bytes,
           '/object/public/' || o.bucket_id || '/' || o.name AS url_tail
    FROM storage.objects o
),
refs AS (
    SELECT poster_image_url AS url FROM public.events WHERE poster_image_url IS NOT NULL
    UNION
    SELECT unnest(image_urls) FROM public.raw_posts
),
marked AS (
    SELECT objs.*,
           EXISTS (SELECT 1 FROM refs WHERE refs.url LIKE '%' || objs.url_tail) AS used
    FROM objs
)
SELECT json_build_object(
    'buckets', (
        SELECT COALESCE(json_agg(b ORDER BY b.bytes DESC), '[]'::json) FROM (
            SELECT bucket_id AS bucket, count(*) AS files, sum(bytes) AS bytes,
                   count(*) FILTER (WHERE NOT used) AS unused_files,
                   COALESCE(sum(bytes) FILTER (WHERE NOT used), 0) AS unused_bytes
            FROM marked GROUP BY bucket_id
        ) b
    ),
    'storage_bytes', (SELECT COALESCE(sum(bytes), 0) FROM objs),
    'db_bytes', pg_database_size(current_database()),
    'tables', (
        SELECT COALESCE(json_agg(t ORDER BY t.bytes DESC), '[]'::json) FROM (
            SELECT c.relname AS name, pg_total_relation_size(c.oid) AS bytes, c.reltuples::bigint AS rows_estimate
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
        ) t
    ),
    'largest', (
        SELECT COALESCE(json_agg(l), '[]'::json) FROM (
            SELECT bucket_id AS bucket, name, bytes, used, created_at
            FROM marked ORDER BY bytes DESC LIMIT 10
        ) l
    ),
    'by_month', (
        SELECT COALESCE(json_agg(m ORDER BY m.month), '[]'::json) FROM (
            SELECT to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') AS month,
                   count(*) AS files, sum(bytes) AS bytes
            FROM objs GROUP BY 1
        ) m
    )
);
$$;

GRANT EXECUTE ON FUNCTION public.storage_usage() TO anon, authenticated;
