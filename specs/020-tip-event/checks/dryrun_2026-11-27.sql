DO $outer$
DECLARE
    r jsonb := '{}'::jsonb;
    j jsonb;
    n0 int; n1 int;
    uid uuid;
    ev uuid;
    pid uuid;
    ppath text;
    ok boolean;
BEGIN
    PERFORM set_config('lock_timeout', '3s', true);
    EXECUTE $mig$
-- 숨은 행사 제보 (specs/020-tip-event). 운영자 결정 2026-11-27: 로그인 없이 제보, 이름 + 링크나 사진 하나, 매주 5명 커피 쿠폰.
--   reports.user_id      : NULL 허용(로그인 없는 제보). 오류 신고(kind=error)는 여전히 회원만
--   reports.tip          : {title, url?, photo?, date_start?, date_end?, venue?, region?} — url 이나 photo(true) 가운데 하나는 있어야 한다
--   reports.photo_path   : leaflets 버킷의 tips/<제보 id>.jpg (비공개, 관리자만 봄). 1년 뒤 leaflet_queue.py --cleanup 이 지우고 비운다
--   reports.credit_name  : «제보: ○○»에 쓸 이름. 본인이 적었을 때만. 행사로 등록할 때 events.tip_credit 로 옮겨 적는다
--   reports.reward_contact / reward_consent / reward_sent_at : 커피 쿠폰 연락처(선택)와 동의한 문구 판, 쿠폰 보낸 때.
--                          연락처는 쿠폰을 보낸 뒤 관리자가 지운다. 보내지 않은 것도 90일 뒤 지운다(개인정보처리방침)
--   submit_tip(jsonb)    : 유일한 접수 입구(anon·authenticated). 로그인 없는 제보는 사이트 전체 하루 40건, 회원은 하루 10건,
--                          같은 이름·같은 링크는 하루 한 번. 접속 주소(IP)는 저장하지 않는다
--   tips/ 사진 올리기    : submit_tip 이 방금(10분 안) 만든 제보가 그 경로를 가리킬 때만 한 번 넣을 수 있다(덮어쓰기 없음)
-- 읽기 권한은 그대로다: 회원은 자기 것, 관리자는 전부, 익명은 0줄.
-- 되돌리기: DROP POLICY "Tip upload pending photo" ON storage.objects;
--           DROP FUNCTION public.submit_tip(jsonb); DROP FUNCTION public.tip_upload_allowed(text); DROP FUNCTION public.tip_photo_failed(uuid);
--           ALTER TABLE public.events DROP COLUMN tip_credit;
--           DELETE FROM public.reports WHERE user_id IS NULL;  (그 뒤에) ALTER TABLE public.reports ALTER COLUMN user_id SET NOT NULL;
--           ALTER TABLE public.reports DROP CONSTRAINT reports_anon_is_tip, DROP CONSTRAINT reports_photo_path_check,
--               DROP CONSTRAINT reports_credit_check, DROP CONSTRAINT reports_reward_check,
--               DROP COLUMN photo_path, DROP COLUMN credit_name, DROP COLUMN reward_contact, DROP COLUMN reward_consent, DROP COLUMN reward_sent_at;
--           reports_tip_has_fields · "Member insert own report" · storage_usage() 는 20261126020000 · 20261126070000 판으로

ALTER TABLE public.reports ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS photo_path text,
    ADD COLUMN IF NOT EXISTS credit_name text,
    ADD COLUMN IF NOT EXISTS reward_contact text,
    ADD COLUMN IF NOT EXISTS reward_consent text,
    ADD COLUMN IF NOT EXISTS reward_sent_at timestamptz;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_tip_has_fields;
ALTER TABLE public.reports ADD CONSTRAINT reports_tip_has_fields
    CHECK (kind <> 'tip' OR (tip ? 'title' AND (tip ? 'url' OR tip ? 'photo')));
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_anon_is_tip;
ALTER TABLE public.reports ADD CONSTRAINT reports_anon_is_tip
    CHECK (user_id IS NOT NULL OR kind = 'tip');
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_photo_path_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_photo_path_check
    CHECK (photo_path IS NULL OR photo_path ~ '^tips/[0-9a-f-]{36}\.jpg$');
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_credit_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_credit_check
    CHECK (credit_name IS NULL OR char_length(credit_name) BETWEEN 1 AND 30);
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reward_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_reward_check
    CHECK ((reward_contact IS NULL OR (char_length(reward_contact) BETWEEN 5 AND 100 AND reward_consent IS NOT NULL))
       AND (reward_consent IS NULL OR char_length(reward_consent) BETWEEN 1 AND 40));

-- 회원이 표에 직접 넣는 길(오류 신고 「정보가 틀렸어요」가 쓴다)로는 새 칸을 채울 수 없다. 제보는 submit_tip 으로만 넣는다
DROP POLICY IF EXISTS "Member insert own report" ON public.reports;
CREATE POLICY "Member insert own report" ON public.reports
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND status = 'new' AND admin_note IS NULL AND handled_at IS NULL
                AND photo_path IS NULL AND credit_name IS NULL
                AND reward_contact IS NULL AND reward_consent IS NULL AND reward_sent_at IS NULL
                AND public.my_reports_today() < 10);

-- 제보로 등록한 행사에 보이는 «제보: ○○» (본인이 이름을 적었고 관리자가 켜 둔 채 등록했을 때만)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tip_credit text;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_tip_credit_check;
ALTER TABLE public.events ADD CONSTRAINT events_tip_credit_check
    CHECK (tip_credit IS NULL OR char_length(tip_credit) BETWEEN 1 AND 30);

-- 제보 접수. 돌려주는 값: {id, photo_path}  (photo_path 가 있으면 브라우저가 그 경로에 사진을 한 번 올린다)
-- 오류(P0001): bad_title · bad_url · need_source · bad_date · need_consent · site_limit · daily_limit · duplicate
CREATE OR REPLACE FUNCTION public.submit_tip(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    uid       uuid := auth.uid();
    new_id    uuid := gen_random_uuid();
    v_title   text := left(btrim(coalesce(p->>'title', '')), 120);
    v_url     text := left(btrim(coalesce(p->>'url', '')), 500);
    v_photo   boolean := coalesce(p->>'has_photo', '') = 'true';
    v_start   text := btrim(coalesce(p->>'date_start', ''));
    v_end     text := btrim(coalesce(p->>'date_end', ''));
    v_venue   text := left(btrim(coalesce(p->>'venue', '')), 120);
    v_region  text := left(btrim(coalesce(p->>'region', '')), 20);
    v_body    text := left(btrim(coalesce(p->>'body', '')), 2000);
    v_contact text := left(btrim(coalesce(p->>'reward_contact', '')), 100);
    v_consent text := left(btrim(coalesce(p->>'reward_consent', '')), 40);
    v_credit  text := left(btrim(coalesce(p->>'credit_name', '')), 30);
    v_path    text;
BEGIN
    -- 사람 눈에 안 보이는 칸이 차 있으면 자동 프로그램이다: 넣지 않고 성공처럼 답한다
    IF btrim(coalesce(p->>'website', '')) <> '' THEN
        RETURN jsonb_build_object('id', NULL, 'photo_path', NULL);
    END IF;
    IF char_length(v_title) < 2 THEN RAISE EXCEPTION 'bad_title' USING ERRCODE = 'P0001'; END IF;
    IF v_url <> '' AND v_url !~* '^https?://[^[:space:]]+\.[^[:space:]]+$' THEN RAISE EXCEPTION 'bad_url' USING ERRCODE = 'P0001'; END IF;
    IF v_url = '' AND NOT v_photo THEN RAISE EXCEPTION 'need_source' USING ERRCODE = 'P0001'; END IF;
    IF (v_start <> '' AND v_start !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$') OR (v_end <> '' AND v_end !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$')
       OR (v_start <> '' AND v_end <> '' AND v_end < v_start) THEN
        RAISE EXCEPTION 'bad_date' USING ERRCODE = 'P0001';
    END IF;
    IF v_contact <> '' AND (v_consent = '' OR char_length(v_contact) < 5) THEN RAISE EXCEPTION 'need_consent' USING ERRCODE = 'P0001'; END IF;

    IF uid IS NULL THEN
        IF (SELECT count(*) FROM public.reports WHERE user_id IS NULL AND created_at > now() - interval '1 day') >= 40 THEN
            RAISE EXCEPTION 'site_limit' USING ERRCODE = 'P0001';
        END IF;
    ELSIF (SELECT count(*) FROM public.reports WHERE user_id = uid AND created_at > now() - interval '1 day') >= 10 THEN
        RAISE EXCEPTION 'daily_limit' USING ERRCODE = 'P0001';
    END IF;
    IF v_url <> '' AND EXISTS (SELECT 1 FROM public.reports
                               WHERE kind = 'tip' AND lower(tip->>'title') = lower(v_title) AND lower(tip->>'url') = lower(v_url)
                                 AND created_at > now() - interval '1 day') THEN
        RAISE EXCEPTION 'duplicate' USING ERRCODE = 'P0001';
    END IF;

    v_path := CASE WHEN v_photo THEN 'tips/' || new_id::text || '.jpg' END;
    INSERT INTO public.reports (id, kind, user_id, body, tip, photo_path, credit_name, reward_contact, reward_consent)
    VALUES (
        new_id, 'tip', uid,
        CASE WHEN char_length(v_body) >= 2 THEN v_body ELSE '(설명 없음)' END,
        jsonb_strip_nulls(jsonb_build_object(
            'title', v_title,
            'url', nullif(v_url, ''),
            'photo', CASE WHEN v_photo THEN true END,
            'date_start', nullif(v_start, ''),
            'date_end', coalesce(nullif(v_end, ''), nullif(v_start, '')),
            'venue', nullif(v_venue, ''),
            'region', nullif(v_region, ''))),
        v_path, nullif(v_credit, ''),
        nullif(v_contact, ''), CASE WHEN v_contact <> '' THEN v_consent END);
    RETURN jsonb_build_object('id', new_id, 'photo_path', v_path);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_tip(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_tip(jsonb) TO anon, authenticated;

-- 사진 올리기 허용 판정: tips/<id>.jpg 이고, 그 경로를 가리키는 제보가 10분 안에 만들어졌고 아직 검토 대기
CREATE OR REPLACE FUNCTION public.tip_upload_allowed(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.reports
        WHERE photo_path = p_name AND kind = 'tip' AND status = 'new'
          AND created_at > now() - interval '10 minutes'
    );
$$;
REVOKE ALL ON FUNCTION public.tip_upload_allowed(text) FROM public;
GRANT EXECUTE ON FUNCTION public.tip_upload_allowed(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Tip upload pending photo" ON storage.objects;
CREATE POLICY "Tip upload pending photo" ON storage.objects FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'leaflets' AND (storage.foldername(name))[1] = 'tips' AND public.tip_upload_allowed(name));

-- 사진을 올리지 못했을 때 브라우저가 부른다: 파일이 실제로 없을 때만 경로를 비운다(관리자 화면에 «사진 올리기 실패»로 보인다)
CREATE OR REPLACE FUNCTION public.tip_photo_failed(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.reports r
    SET photo_path = NULL, admin_note = '사진 올리기 실패'
    WHERE r.id = p_id AND r.kind = 'tip' AND r.status = 'new' AND r.photo_path IS NOT NULL
      AND r.created_at > now() - interval '10 minutes'
      AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'leaflets' AND o.name = r.photo_path);
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.tip_photo_failed(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.tip_photo_failed(uuid) TO anon, authenticated;

-- 저장공간 보고: 제보 사진도 제보 기록이 가리키므로 «쓰는 것»으로 센다 (나머지는 20261126070000 판과 같다)
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
    SELECT count(*) INTO n0 FROM public.reports;
    -- t1 익명: 이름+링크
    j := public.submit_tip('{"title":"[시험] 골목 버스킹","url":"https://example.com/p/1"}'::jsonb);
    r := r || jsonb_build_object('t1_anon_url', (j->>'id') IS NOT NULL AND (j->>'photo_path') IS NULL
        AND EXISTS (SELECT 1 FROM public.reports WHERE id = (j->>'id')::uuid AND user_id IS NULL AND tip->>'url' = 'https://example.com/p/1' AND NOT tip ? 'photo' AND body = '(설명 없음)'));
    -- t2 이름만
    BEGIN PERFORM public.submit_tip('{"title":"[시험] 이름만"}'::jsonb); r := r || '{"t2_need_source":false}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t2_need_source', SQLERRM = 'need_source'); END;
    -- t3 연락처 + 동의 없음
    BEGIN PERFORM public.submit_tip('{"title":"[시험] 연락처","url":"https://example.com/p/3","reward_contact":"010-1234-5678"}'::jsonb); r := r || '{"t3_need_consent":false}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t3_need_consent', SQLERRM = 'need_consent'); END;
    -- t4 같은 이름·링크 두 번
    BEGIN PERFORM public.submit_tip('{"title":"[시험] 골목 버스킹","url":"HTTPS://example.com/p/1"}'::jsonb); r := r || '{"t4_duplicate":false}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t4_duplicate', SQLERRM = 'duplicate'); END;
    -- t5 사진만 + 연락처 동의 + 이름
    j := public.submit_tip('{"title":"[시험] 사진 제보","has_photo":"true","reward_contact":"010-1234-5678","reward_consent":"tip-reward-r1-2026-11-27","credit_name":"봉황동 주민","date_start":"2026-12-05","venue":"봉황동"}'::jsonb);
    pid := (j->>'id')::uuid; ppath := j->>'photo_path';
    r := r || jsonb_build_object('t5_photo', ppath = 'tips/' || pid::text || '.jpg'
        AND EXISTS (SELECT 1 FROM public.reports WHERE id = pid AND photo_path = ppath AND reward_contact = '010-1234-5678' AND reward_consent IS NOT NULL
                    AND credit_name = '봉황동 주민' AND tip->>'photo' = 'true' AND tip->>'date_end' = '2026-12-05' AND NOT tip ? 'url'),
        't5_upload_allowed', public.tip_upload_allowed(ppath) AND NOT public.tip_upload_allowed('tips/00000000-0000-0000-0000-000000000000.jpg'));
    -- t6 사진 올리기 실패 알림
    ok := public.tip_photo_failed(pid);
    r := r || jsonb_build_object('t6_photo_failed', ok AND EXISTS (SELECT 1 FROM public.reports WHERE id = pid AND photo_path IS NULL AND admin_note = '사진 올리기 실패' AND tip ? 'photo'));
    -- t7 보이지 않는 칸
    SELECT count(*) INTO n1 FROM public.reports;
    j := public.submit_tip('{"title":"[시험] 봇","url":"https://example.com/p/7","website":"x"}'::jsonb);
    r := r || jsonb_build_object('t7_honeypot', (j->>'id') IS NULL AND (SELECT count(*) FROM public.reports) = n1);
    -- t8 형식
    BEGIN PERFORM public.submit_tip('{"title":"[시험] 주소","url":"instagram.com/p/1"}'::jsonb); r := r || '{"t8_bad_url":false}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t8_bad_url', SQLERRM = 'bad_url'); END;
    BEGIN PERFORM public.submit_tip('{"title":"[시험] 날짜","url":"https://example.com/p/8","date_start":"2026-12-05","date_end":"2026-12-01"}'::jsonb); r := r || '{"t8_bad_date":false}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t8_bad_date', SQLERRM = 'bad_date'); END;
    -- t9 익명 역할: 읽기 0줄, 직접 넣기 막힘, 함수는 됨
    SET LOCAL ROLE anon;
    r := r || jsonb_build_object('t9_anon_reads', (SELECT count(*) FROM public.reports));
    BEGIN INSERT INTO public.reports (kind, body, tip) VALUES ('tip', '직접 넣기', '{"title":"x","url":"https://example.com"}'); r := r || '{"t9_anon_direct_insert_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t9_anon_direct_insert_blocked', true, 't9_err', left(SQLERRM, 60)); END;
    j := public.submit_tip('{"title":"[시험] 익명 역할","url":"https://example.com/p/9"}'::jsonb);
    r := r || jsonb_build_object('t9_anon_rpc', (j->>'id') IS NOT NULL);
    RESET ROLE;
    -- t10 회원: 오류 신고 직접 넣기 통과, 새 칸 채우면 막힘, 제보는 함수로, 자기 것만 읽음
    SELECT id INTO uid FROM auth.users ORDER BY created_at LIMIT 1;
    SELECT id INTO ev FROM public.events WHERE status = 'PUBLISHED' LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub', uid::text, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN INSERT INTO public.reports (kind, event_id, category, body) VALUES ('error', ev, '기타', '[시험] 오류 신고'); r := r || '{"t10_member_error_insert":true}';
    EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('t10_member_error_insert', false, 't10_err', left(SQLERRM, 80)); END;
    BEGIN INSERT INTO public.reports (kind, body, tip, reward_contact, reward_consent) VALUES ('tip', '직접', '{"title":"x","url":"https://example.com"}', '010-0000-0000', 'v'); r := r || '{"t10_member_direct_reward_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t10_member_direct_reward_blocked":true}'; END;
    j := public.submit_tip('{"title":"[시험] 회원 제보","url":"https://example.com/p/10"}'::jsonb);
    r := r || jsonb_build_object('t10_member_rpc', EXISTS (SELECT 1 FROM public.reports WHERE id = (j->>'id')::uuid AND user_id = uid));
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    -- t11 행사 표시 이름 길이, 저장공간 함수
    BEGIN UPDATE public.events SET tip_credit = repeat('가', 31) WHERE id = ev; r := r || '{"t11_credit_len_blocked":false}';
    EXCEPTION WHEN OTHERS THEN r := r || '{"t11_credit_len_blocked":true}'; END;
    UPDATE public.events SET tip_credit = '봉황동 주민' WHERE id = ev;
    r := r || jsonb_build_object('t11_credit_ok', (SELECT tip_credit FROM public.events WHERE id = ev) = '봉황동 주민',
                                 't11_storage_usage_defined', (SELECT prosrc LIKE '%public.reports WHERE photo_path IS NOT NULL%' FROM pg_proc WHERE proname = 'storage_usage' AND pronamespace = 'public'::regnamespace),
                                 'rows_before', n0, 'rows_in_test', (SELECT count(*) FROM public.reports) - n0);
    RAISE EXCEPTION 'TIPTEST %', r::text;
END
$outer$;
