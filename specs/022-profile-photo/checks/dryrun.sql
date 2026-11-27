DO $outer$
DECLARE
    r jsonb := '{}'::jsonb;
    n1 int;
    uid uuid; uid2 uuid;
    mine text; theirs text;
BEGIN
    PERFORM set_config('lock_timeout', '3s', true);
    EXECUTE $mig$
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

$mig$;
    -- 운영 DB 되돌림 시험의 시험 부분(specs/022). make_dryrun.py 가 마이그레이션과 묶어 한 문장(DO 블록)으로 만든다.
    -- 끝의 RAISE EXCEPTION 이 결과를 내보내면서 이 문장이 한 일을 모두 되돌린다(남는 변경 없음).
    SELECT p.id INTO uid FROM public.profiles p WHERE coalesce(p.role, 'user') <> 'admin' ORDER BY p.created_at LIMIT 1;
    SELECT p.id INTO uid2 FROM public.profiles p WHERE p.id <> uid ORDER BY p.created_at LIMIT 1;
    mine := uid::text || '/11111111-2222-3333-4444-555555555555.jpg';
    theirs := uid2::text || '/11111111-2222-3333-4444-555555555555.jpg';

    -- t1 회원 기록의 사진 칸: 자기 경로만
    UPDATE public.profiles SET avatar_path = mine WHERE id = uid;
    r := r || jsonb_build_object('t1_own_path_saved', (SELECT avatar_path = mine FROM public.profiles WHERE id = uid));
    BEGIN UPDATE public.profiles SET avatar_path = theirs WHERE id = uid; r := r || '{"t1_other_path_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t1_other_path_blocked":true}'; END;
    BEGIN UPDATE public.profiles SET avatar_path = uid::text || '/x.png' WHERE id = uid; r := r || '{"t1_bad_format_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t1_bad_format_blocked":true}'; END;

    -- t2 저장소: 회원은 자기 폴더에만 넣고·읽고·지운다
    PERFORM set_config('request.jwt.claim.sub', uid::text, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('avatars', mine, uid); r := r || '{"t2_own_folder_insert":true}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t2_own_folder_insert', false, 't2_err', left(SQLERRM, 80)); END;
    BEGIN INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('avatars', theirs, uid); r := r || '{"t2_other_folder_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t2_other_folder_blocked":true}'; END;
    r := r || jsonb_build_object('t2_own_rows_visible', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars'));
    RESET ROLE;

    -- t3 다른 회원: 내 파일 줄을 못 읽고 못 지운다
    PERFORM set_config('request.jwt.claim.sub', uid2::text, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    r := r || jsonb_build_object('t3_other_sees_rows', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars'));
    -- (지우기는 SQL 로 시험할 수 없다: Supabase 가 저장소 표의 직접 DELETE 를 막는다. 지우기 권한은 배포 뒤 저장소 API 로 확인한다)
    BEGIN UPDATE public.profiles SET avatar_path = NULL WHERE id = uid; GET DIAGNOSTICS n1 = ROW_COUNT; r := r || jsonb_build_object('t3_other_profile_update_rows', n1);
    EXCEPTION WHEN OTHERS THEN r := r || '{"t3_other_profile_update_rows":0}'; END;
    RESET ROLE;

    -- t4 익명: 넣기·읽기 불가
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    SET LOCAL ROLE anon;
    BEGIN INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', mine || 'x'); r := r || '{"t4_anon_insert_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t4_anon_insert_blocked":true}'; END;
    BEGIN r := r || jsonb_build_object('t4_anon_sees_rows', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars'));
    EXCEPTION WHEN OTHERS THEN r := r || '{"t4_anon_sees_rows":0}'; END;
    RESET ROLE;

    -- t5 버킷 설정, 저장공간 함수에 반영
    r := r || jsonb_build_object(
        't5_bucket_private', (SELECT NOT public AND file_size_limit = 1048576 FROM storage.buckets WHERE id = 'avatars'),
        't5_storage_usage_defined', (SELECT prosrc LIKE '%public.profiles WHERE avatar_path IS NOT NULL%' FROM pg_proc WHERE proname = 'storage_usage' AND pronamespace = 'public'::regnamespace));
    RAISE EXCEPTION 'AVTEST %', r::text;
END
$outer$;
