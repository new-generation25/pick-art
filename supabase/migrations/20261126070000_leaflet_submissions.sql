-- 리플렛 한 장으로 행사 등록 (specs/013). 운영자 11/26 결정: 로그인 회원만 올림, AI 읽기는 클로드 예약작업,
-- 공식 페이지가 있으면 원본으로 잇고 없으면 «단체 제공» 표시, 이미지 보관 1년, 휴대폰 사진은 포스터로 쓰지 않음
--
-- leaflet_submissions : 제출 한 건. 회원은 자기 것만 넣고 읽는다(하루 5장). 바꾸기는 관리자만(예약작업은 service 키)
--   image_kind: file(리플렛·포스터 파일 — 포스터로 쓸 수 있음) · photo(휴대폰으로 찍은 사진 — 글자만 읽고 포스터로 쓰지 않음)
--   status: uploaded(올림) → read(예약작업이 읽음) → published(등록) / rejected(반영 안 함)
-- leaflets 버킷 : 비공개. 경로 <회원 uid>/<파일>. 회원은 자기 폴더에만 넣고 읽는다, 관리자는 모두 읽는다
-- storage_usage() : 리플렛 파일을 «안 쓰는 이미지»로 세지 않게 참조 목록에 더한다
-- 되돌리기: DROP TABLE public.leaflet_submissions; DROP FUNCTION public.my_leaflets_today();
--           버킷 파일을 지운 뒤 DELETE FROM storage.buckets WHERE id = 'leaflets'; 정책 세 개 DROP; storage_usage 를 20261101000000 판으로

CREATE TABLE IF NOT EXISTS public.leaflet_submissions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    image_path     text CHECK (image_path IS NULL OR char_length(image_path) <= 200),  -- 1년 뒤 파일을 지우면 NULL
    image_kind     text NOT NULL CHECK (image_kind IN ('file', 'photo')),
    official_url   text CHECK (official_url IS NULL OR (official_url ~ '^https?://' AND char_length(official_url) <= 500)),
    group_name     text CHECK (group_name IS NULL OR char_length(group_name) <= 80),
    given          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 단체가 직접 적은 칸(제목·날짜·장소 등, 있으면)
    note           text CHECK (note IS NULL OR char_length(note) <= 1000),
    rights_version text NOT NULL CHECK (char_length(rights_version) <= 40),  -- 동의한 권리 확인 문구 판
    ai_result      jsonb,                                 -- 예약작업이 읽은 칸: {칸: {raw, value, confidence}}
    ai_read_at     timestamptz,
    status         text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'read', 'published', 'rejected')),
    admin_note     text CHECK (admin_note IS NULL OR char_length(admin_note) <= 1000),
    event_id       uuid REFERENCES public.events(id) ON DELETE SET NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    handled_at     timestamptz
);
CREATE INDEX IF NOT EXISTS leaflet_submissions_status_idx ON public.leaflet_submissions (status, created_at);

CREATE OR REPLACE FUNCTION public.my_leaflets_today()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT count(*)::integer FROM public.leaflet_submissions
    WHERE user_id = auth.uid() AND created_at > now() - interval '1 day';
$$;
REVOKE ALL ON FUNCTION public.my_leaflets_today() FROM public;
GRANT EXECUTE ON FUNCTION public.my_leaflets_today() TO authenticated;

ALTER TABLE public.leaflet_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Member insert own leaflet" ON public.leaflet_submissions;
CREATE POLICY "Member insert own leaflet" ON public.leaflet_submissions FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND status = 'uploaded' AND ai_result IS NULL AND event_id IS NULL AND admin_note IS NULL
        AND image_path LIKE auth.uid()::text || '/%'
        AND public.my_leaflets_today() < 5
    );
DROP POLICY IF EXISTS "Member read own leaflet" ON public.leaflet_submissions;
CREATE POLICY "Member read own leaflet" ON public.leaflet_submissions FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Admin update leaflet" ON public.leaflet_submissions;
CREATE POLICY "Admin update leaflet" ON public.leaflet_submissions FOR UPDATE TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 비공개 버킷: 10MB, jpeg·png·webp
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('leaflets', 'leaflets', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Member upload own leaflet file" ON storage.objects;
CREATE POLICY "Member upload own leaflet file" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'leaflets' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Member read own leaflet file" ON storage.objects;
CREATE POLICY "Member read own leaflet file" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'leaflets' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

-- 저장공간 보고: 리플렛 파일은 제출 기록이 가리키므로 «쓰는 것»으로 센다 (나머지는 20261101000000 판과 같다)
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
