-- 프로필 사진 (specs/022-profile-photo). 운영자 2026-11-27 «프로필 설정에서 이미지 추가할수 있게 바꾸고».
--   profiles.avatar_path : avatars 버킷 안의 <회원 id>/<파일 id>.jpg. 자기 id 로 시작하는 경로만 적을 수 있다. 없으면 NULL
--   avatars 버킷         : 비공개, 1MB, image/jpeg 만. 회원은 자기 폴더에만 올리고·읽고·지운다. 익명과 다른 회원은 아무것도 못 한다
--                          (지금은 본인 화면 «내 정보»·머리 줄에만 쓴다. 다른 회원에게 보이는 자리가 생기면 공개 범위를 다시 정한다)
--   바꿀 때는 새 파일 이름으로 올리고 옛 파일을 지운다(고치기 정책 없음)
--   탈퇴한 회원의 파일은 collector/tools/leaflet_queue.py --cleanup 이 지운다
--   storage_usage()      : 프로필 사진을 «쓰는 파일»로 센다 (나머지는 20261127130000 판과 같다)
-- 되돌리기: DROP POLICY "Member upload own avatar" ON storage.objects; DROP POLICY "Member read own avatar" ON storage.objects;
--           DROP POLICY "Member delete own avatar" ON storage.objects;
--           버킷 파일을 지운 뒤 DELETE FROM storage.buckets WHERE id = 'avatars';
--           ALTER TABLE public.profiles DROP COLUMN avatar_path;   storage_usage() 는 20261127130000 판으로

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_path_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_path_check
    CHECK (avatar_path IS NULL OR avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.jpg$'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 1048576, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Member upload own avatar" ON storage.objects;
CREATE POLICY "Member upload own avatar" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Member read own avatar" ON storage.objects;
CREATE POLICY "Member read own avatar" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Member delete own avatar" ON storage.objects;
CREATE POLICY "Member delete own avatar" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

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
    UNION
    SELECT '/object/public/leaflets/' || image_path FROM public.leaflet_submissions WHERE image_path IS NOT NULL
    UNION
    SELECT '/object/public/leaflets/' || photo_path FROM public.reports WHERE photo_path IS NOT NULL
    UNION
    SELECT '/object/public/avatars/' || avatar_path FROM public.profiles WHERE avatar_path IS NOT NULL
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
