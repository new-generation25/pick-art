-- 카카오톡 채널로 행사 정보 받기 (specs/017). 013 리플렛 흐름(leaflet_submissions → 예약작업 읽기 → 관리자 검토 «등록»)에 그대로 들어온다.
--   channel   : web(사이트에서 올림, 013) · kakao_bot(카카오 i 오픈빌더 챗봇 스킬로 들어옴) · kakao_chat(운영자가 채널 1:1 채팅에서 옮겨 올림)
--   sender_key: 챗봇이 넘겨주는 보낸 사람 식별값(botUserKey)을 sha256 으로 바꾼 것만 둔다. 원래 값·카카오 이름·전화번호는 저장하지 않는다
--   kakao_senders : 보낸 사람이 권리 확인 문구(013 r1-2026-11-26)에 동의했는지. 동의하기 전에는 사진을 받지 않는다
--   보관: 사진 1년(013 cleanup 그대로), sender_key·kakao_senders 도 1년 지나면 --cleanup 이 지운다(개인정보처리방침)
--   kakao_skill_keys : 스킬 요청을 알아보는 비밀값의 sha256. 원래 값은 오픈빌더 스킬 설정(헤더)에만 둔다. 이 표는 누구도 읽을 수 없다(정책 없음)
--   kakao_intake() : 익명(anon) 키로 부르는 유일한 입구. 비밀값을 확인한 뒤에만 넣는다. 하루 5장(013과 같음), 사이트 전체 하루 60장
--   leaflets 버킷 업로드 : kakao/<제출 id>.jpg 경로는 kakao_intake 가 방금(10분 안) 만든 줄이 있을 때만 익명이 한 번 넣을 수 있다(덮어쓰기 없음)
-- 되돌리기: DROP FUNCTION public.kakao_intake(text,text,text,text,text); DROP FUNCTION public.kakao_upload_allowed(text);
--           DROP FUNCTION public.kakao_upload_failed(text,uuid);
--           DROP POLICY "Kakao upload pending leaflet file" ON storage.objects;
--           DROP TABLE public.kakao_senders; DROP TABLE public.kakao_skill_keys;
--           DELETE FROM public.leaflet_submissions WHERE user_id IS NULL;  (그 뒤에) ALTER TABLE ... ALTER COLUMN user_id SET NOT NULL;
--           ALTER TABLE public.leaflet_submissions DROP COLUMN channel, DROP COLUMN sender_key;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.leaflet_submissions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.leaflet_submissions
    ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'web',
    ADD COLUMN IF NOT EXISTS sender_key text;
ALTER TABLE public.leaflet_submissions DROP CONSTRAINT IF EXISTS leaflet_submissions_channel_check;
ALTER TABLE public.leaflet_submissions ADD CONSTRAINT leaflet_submissions_channel_check
    CHECK (channel IN ('web', 'kakao_bot', 'kakao_chat'));
ALTER TABLE public.leaflet_submissions DROP CONSTRAINT IF EXISTS leaflet_submissions_sender_check;
ALTER TABLE public.leaflet_submissions ADD CONSTRAINT leaflet_submissions_sender_check
    CHECK ((channel <> 'kakao_bot' AND user_id IS NOT NULL AND sender_key IS NULL)
        OR (channel = 'kakao_bot' AND user_id IS NULL AND (sender_key IS NULL OR sender_key ~ '^[0-9a-f]{64}$')));
-- sender_key 는 1년이 지나면 leaflet_queue.py --cleanup 이 비운다(그래서 kakao_bot 줄도 NULL 을 허용)
CREATE INDEX IF NOT EXISTS leaflet_submissions_sender_idx ON public.leaflet_submissions (sender_key, created_at) WHERE sender_key IS NOT NULL;

-- 회원이 사이트에서 넣을 때(013 정책)는 channel 이 web 이어야 한다. 관리자는 채팅에서 옮겨 올린 것(kakao_chat)도 넣는다
DROP POLICY IF EXISTS "Member insert own leaflet" ON public.leaflet_submissions;
CREATE POLICY "Member insert own leaflet" ON public.leaflet_submissions FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND status = 'uploaded' AND ai_result IS NULL AND event_id IS NULL AND admin_note IS NULL
        AND image_path LIKE auth.uid()::text || '/%'
        AND sender_key IS NULL
        AND (channel = 'web' AND public.my_leaflets_today() < 5 OR channel = 'kakao_chat' AND public.is_admin())
    );

CREATE TABLE IF NOT EXISTS public.kakao_senders (
    sender_key     text PRIMARY KEY CHECK (sender_key ~ '^[0-9a-f]{64}$'),
    rights_version text NOT NULL CHECK (char_length(rights_version) <= 40),
    agreed_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kakao_senders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read kakao senders" ON public.kakao_senders;
CREATE POLICY "Admin read kakao senders" ON public.kakao_senders FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.kakao_skill_keys (
    key_hash   text PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kakao_skill_keys ENABLE ROW LEVEL SECURITY;  -- 정책 없음: anon·회원·관리자 모두 읽지 못한다(SQL 편집기·함수만)

-- 챗봇 스킬 입구. p_action: agree(권리 확인 동의) · image(사진 한 장) · text(글) · status(동의 여부만 묻기)
-- 돌려주는 값: {ok, agreed, id?, image_path?, error?}  error: auth · not_agreed · daily_limit · site_limit · bad_input
CREATE OR REPLACE FUNCTION public.kakao_intake(p_secret text, p_user text, p_action text, p_text text DEFAULT NULL, p_rights text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    skey text;
    agreed text;
    new_id uuid;
    path text;
    t text := left(btrim(coalesce(p_text, '')), 1000);
    last_row public.leaflet_submissions%ROWTYPE;
BEGIN
    IF p_secret IS NULL OR NOT EXISTS (SELECT 1 FROM public.kakao_skill_keys WHERE key_hash = encode(digest(p_secret, 'sha256'), 'hex')) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth');
    END IF;
    IF p_user IS NULL OR char_length(p_user) NOT BETWEEN 1 AND 200 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bad_input');
    END IF;
    skey := encode(digest('pica-kakao:' || p_user, 'sha256'), 'hex');
    SELECT rights_version INTO agreed FROM public.kakao_senders WHERE sender_key = skey;

    IF p_action = 'agree' THEN
        IF p_rights IS NULL OR char_length(p_rights) NOT BETWEEN 1 AND 40 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'bad_input');
        END IF;
        INSERT INTO public.kakao_senders (sender_key, rights_version) VALUES (skey, p_rights)
        ON CONFLICT (sender_key) DO UPDATE SET rights_version = EXCLUDED.rights_version, agreed_at = now();
        RETURN jsonb_build_object('ok', true, 'agreed', true);
    ELSIF p_action = 'status' THEN
        RETURN jsonb_build_object('ok', true, 'agreed', agreed IS NOT NULL AND agreed = coalesce(p_rights, agreed));
    ELSIF p_action NOT IN ('image', 'text') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bad_input');
    END IF;

    IF agreed IS NULL OR (p_rights IS NOT NULL AND agreed <> p_rights) THEN
        RETURN jsonb_build_object('ok', false, 'agreed', false, 'error', 'not_agreed');
    END IF;

    IF p_action = 'text' THEN
        IF t = '' THEN RETURN jsonb_build_object('ok', false, 'agreed', true, 'error', 'bad_input'); END IF;
        -- 10분 안에 보낸 사진이 아직 읽히기 전이면 그 제출의 «더 알려 준 것»에 붙인다(사진 + 설명 글을 한 건으로)
        SELECT * INTO last_row FROM public.leaflet_submissions
        WHERE sender_key = skey AND status = 'uploaded' AND created_at > now() - interval '10 minutes'
        ORDER BY created_at DESC LIMIT 1;
        IF FOUND THEN
            UPDATE public.leaflet_submissions
            SET note = left(coalesce(note || E'\n', '') || t, 1000)
            WHERE id = last_row.id;
            RETURN jsonb_build_object('ok', true, 'agreed', true, 'id', last_row.id, 'attached', true);
        END IF;
    END IF;

    IF (SELECT count(*) FROM public.leaflet_submissions WHERE sender_key = skey AND created_at > now() - interval '1 day') >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'agreed', true, 'error', 'daily_limit');
    END IF;
    IF (SELECT count(*) FROM public.leaflet_submissions WHERE channel = 'kakao_bot' AND created_at > now() - interval '1 day') >= 60 THEN
        RETURN jsonb_build_object('ok', false, 'agreed', true, 'error', 'site_limit');
    END IF;

    new_id := gen_random_uuid();
    path := CASE WHEN p_action = 'image' THEN 'kakao/' || new_id::text || '.jpg' END;
    INSERT INTO public.leaflet_submissions (id, user_id, channel, sender_key, image_path, image_kind, group_name, note, rights_version)
    VALUES (new_id, NULL, 'kakao_bot', skey, path, 'photo', NULL, nullif(t, ''), agreed);
    RETURN jsonb_build_object('ok', true, 'agreed', true, 'id', new_id, 'image_path', path);
END;
$$;
REVOKE ALL ON FUNCTION public.kakao_intake(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.kakao_intake(text, text, text, text, text) TO anon;

-- 사진을 버킷에 넣지 못했을 때: 그 줄의 image_path 를 비우고 «읽지 못함»으로 둔다(운영자가 그래도 본다)
CREATE OR REPLACE FUNCTION public.kakao_upload_failed(p_secret text, p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
    IF p_secret IS NULL OR NOT EXISTS (SELECT 1 FROM public.kakao_skill_keys WHERE key_hash = encode(digest(p_secret, 'sha256'), 'hex')) THEN
        RETURN false;
    END IF;
    UPDATE public.leaflet_submissions
    SET image_path = NULL, status = 'read', ai_read_at = now(), ai_result = '{"error": "카카오 사진을 내려받지 못함(채널 1:1 채팅에서 확인)"}'::jsonb
    WHERE id = p_id AND channel = 'kakao_bot' AND status = 'uploaded' AND created_at > now() - interval '10 minutes';
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.kakao_upload_failed(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.kakao_upload_failed(text, uuid) TO anon;

-- 익명 업로드 허용 판정: kakao/<id>.jpg 이고, 그 경로를 가리키는 kakao_bot 제출이 10분 안에 만들어졌고 아직 uploaded
CREATE OR REPLACE FUNCTION public.kakao_upload_allowed(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.leaflet_submissions
        WHERE image_path = p_name AND channel = 'kakao_bot' AND status = 'uploaded'
          AND created_at > now() - interval '10 minutes'
    );
$$;
REVOKE ALL ON FUNCTION public.kakao_upload_allowed(text) FROM public;
GRANT EXECUTE ON FUNCTION public.kakao_upload_allowed(text) TO anon;

DROP POLICY IF EXISTS "Kakao upload pending leaflet file" ON storage.objects;
CREATE POLICY "Kakao upload pending leaflet file" ON storage.objects FOR INSERT TO anon
    WITH CHECK (bucket_id = 'leaflets' AND (storage.foldername(name))[1] = 'kakao' AND public.kakao_upload_allowed(name));
