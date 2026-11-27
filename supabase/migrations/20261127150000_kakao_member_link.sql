-- specs/017 보완: 카카오톡 채널 «행사 알리기» 제보를 보낸 사람을 피카 회원과 잇는다(운영자 11/27 «연결 코드 방식»).
-- 왜: 021 제보 포인트는 leaflet_submissions.user_id 가 있어야 쌓인다. 챗봇은 보낸 사람의 카카오 회원 값(appUserId)을
--     봇에 앱키가 있을 때만 주는데, 피카 채널은 아직 비즈니스 채널이 아니라 앱키를 넣을 수 없다(research.md 11/27).
-- 그래서: 회원이 «내 정보»에서 한 번 쓰는 6자리 코드(10분)를 받아 챗봇에 «연결 123456»을 보내면
--         그 보낸 사람(sender_key = botUserKey 의 sha256)을 그 회원과 잇는다. 구글 가입 회원도 된다.
--   kakao_link_codes   : 회원당 한 줄(코드·만료). 아무도 직접 읽지 못한다(정책 없음, 함수로만)
--   kakao_member_links : sender_key → user_id. 회원이 «연결 끊기»를 누르거나 탈퇴하면 지운다. 관리자는 읽을 수 있다
--   kakao_link_fails   : 틀린 코드 시도. 보낸 사람마다 하루 5번까지(6자리 맞히기 막기)
--   kakao_intake(link) : 코드가 맞으면 잇고, 그 보낸 사람이 전에 보낸 카카오 제보에도 user_id 를 채운다
--   kakao_intake(image·text) : 이은 회원이 있으면 새 제보의 user_id 에 넣는다
-- 원래 카카오 값(botUserKey·appUserId)은 여전히 저장하지 않는다.
-- 되돌리기: 20261127080000_kakao_tip_menu.sql 의 kakao_intake 를 다시 실행하고
--           DROP FUNCTION public.kakao_link_code(); DROP FUNCTION public.kakao_link_status(); DROP FUNCTION public.kakao_unlink();
--           DROP TABLE public.kakao_link_fails; DROP TABLE public.kakao_member_links; DROP TABLE public.kakao_link_codes;
--           UPDATE public.leaflet_submissions SET user_id = NULL WHERE channel = 'kakao_bot';  (그 뒤에) sender_check 를 070000 의 것으로

-- kakao_bot 줄도 이은 회원(user_id)을 가질 수 있게
ALTER TABLE public.leaflet_submissions DROP CONSTRAINT IF EXISTS leaflet_submissions_sender_check;
ALTER TABLE public.leaflet_submissions ADD CONSTRAINT leaflet_submissions_sender_check
    CHECK ((channel <> 'kakao_bot' AND user_id IS NOT NULL AND sender_key IS NULL)
        OR (channel = 'kakao_bot' AND (sender_key IS NULL OR sender_key ~ '^[0-9a-f]{64}$')));

CREATE TABLE IF NOT EXISTS public.kakao_link_codes (
    user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    code       text NOT NULL UNIQUE CHECK (code ~ '^[0-9]{6}$'),
    expires_at timestamptz NOT NULL
);
ALTER TABLE public.kakao_link_codes ENABLE ROW LEVEL SECURITY;  -- 정책 없음

CREATE TABLE IF NOT EXISTS public.kakao_member_links (
    sender_key text PRIMARY KEY CHECK (sender_key ~ '^[0-9a-f]{64}$'),
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    linked_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kakao_member_links_user_idx ON public.kakao_member_links (user_id);
ALTER TABLE public.kakao_member_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read kakao member links" ON public.kakao_member_links;
CREATE POLICY "Admin read kakao member links" ON public.kakao_member_links FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.kakao_link_fails (
    sender_key text NOT NULL CHECK (sender_key ~ '^[0-9a-f]{64}$'),
    at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kakao_link_fails_idx ON public.kakao_link_fails (sender_key, at);
ALTER TABLE public.kakao_link_fails ENABLE ROW LEVEL SECURITY;  -- 정책 없음

-- 회원: 연결 코드 받기(10분). 다시 누르면 새 코드로 바뀐다
CREATE OR REPLACE FUNCTION public.kakao_link_code()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    uid uuid := auth.uid();
    c text;
    exp timestamptz := now() + interval '10 minutes';
BEGIN
    IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
    DELETE FROM public.kakao_link_codes WHERE expires_at < now();
    FOR i IN 1..20 LOOP
        c := lpad((abs(('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
        BEGIN
            INSERT INTO public.kakao_link_codes (user_id, code, expires_at) VALUES (uid, c, exp)
            ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at;
            RETURN jsonb_build_object('ok', true, 'code', c, 'expires_at', exp);
        EXCEPTION WHEN unique_violation THEN
            -- 다른 회원이 같은 코드를 쓰는 중: 다시 뽑는다
        END;
    END LOOP;
    RETURN jsonb_build_object('ok', false, 'error', 'busy');
END;
$$;
REVOKE ALL ON FUNCTION public.kakao_link_code() FROM public;
GRANT EXECUTE ON FUNCTION public.kakao_link_code() TO authenticated;

-- 회원: 이어져 있는지
CREATE OR REPLACE FUNCTION public.kakao_link_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object('linked', count(*) > 0, 'linked_at', max(linked_at))
    FROM public.kakao_member_links WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.kakao_link_status() FROM public;
GRANT EXECUTE ON FUNCTION public.kakao_link_status() TO authenticated;

-- 회원: 연결 끊기. 이미 보낸 제보의 user_id 는 그대로 둔다(그 회원이 보낸 것이 맞으므로). 앞으로 보내는 제보만 회원과 떨어진다
CREATE OR REPLACE FUNCTION public.kakao_unlink()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN false; END IF;
    DELETE FROM public.kakao_member_links WHERE user_id = auth.uid();
    DELETE FROM public.kakao_link_codes WHERE user_id = auth.uid();
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.kakao_unlink() FROM public;
GRANT EXECUTE ON FUNCTION public.kakao_unlink() TO authenticated;

-- p_action: start(행사 알리기) · agree(권리 확인 동의) · image(사진 한 장) · text(글) · status(동의 여부만 묻기) · link(연결 코드, p_text = 6자리)
-- 돌려주는 값: {ok, agreed, id?, image_path?, attached?, linked?, error?}
--   error: auth · not_agreed · not_tip · daily_limit · site_limit · bad_input · bad_code · link_limit
CREATE OR REPLACE FUNCTION public.kakao_intake(p_secret text, p_user text, p_action text, p_text text DEFAULT NULL, p_rights text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    skey text;
    agreed text;
    tip timestamptz;
    ok_agreed boolean;
    member uuid;
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
    SELECT rights_version, tip_until INTO agreed, tip FROM public.kakao_senders WHERE sender_key = skey;
    ok_agreed := agreed IS NOT NULL AND agreed = coalesce(p_rights, agreed);

    IF p_action = 'link' THEN
        IF (SELECT count(*) FROM public.kakao_link_fails WHERE sender_key = skey AND at > now() - interval '1 day') >= 5 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'link_limit');
        END IF;
        SELECT user_id INTO member FROM public.kakao_link_codes WHERE code = t AND expires_at > now();
        IF member IS NULL THEN
            DELETE FROM public.kakao_link_fails WHERE at < now() - interval '1 day';
            INSERT INTO public.kakao_link_fails (sender_key) VALUES (skey);
            RETURN jsonb_build_object('ok', false, 'error', 'bad_code');
        END IF;
        INSERT INTO public.kakao_member_links (sender_key, user_id) VALUES (skey, member)
        ON CONFLICT (sender_key) DO UPDATE SET user_id = EXCLUDED.user_id, linked_at = now();
        DELETE FROM public.kakao_link_codes WHERE user_id = member;
        -- 이 보낸 사람이 전에 보낸 카카오 제보도 같은 사람이 보낸 것이므로 회원에 붙인다
        UPDATE public.leaflet_submissions SET user_id = member
        WHERE channel = 'kakao_bot' AND sender_key = skey AND user_id IS NULL;
        RETURN jsonb_build_object('ok', true, 'linked', true);
    ELSIF p_action = 'agree' THEN
        IF p_rights IS NULL OR char_length(p_rights) NOT BETWEEN 1 AND 40 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'bad_input');
        END IF;
        INSERT INTO public.kakao_senders (sender_key, rights_version, tip_until) VALUES (skey, p_rights, now() + interval '30 minutes')
        ON CONFLICT (sender_key) DO UPDATE SET rights_version = EXCLUDED.rights_version, agreed_at = now(), tip_until = EXCLUDED.tip_until;
        RETURN jsonb_build_object('ok', true, 'agreed', true);
    ELSIF p_action = 'start' THEN
        -- 동의한 사람만 제보 시간을 연다. 동의 전이면 agreed=false 를 돌려주고 서버가 동의 안내를 보인다
        IF ok_agreed THEN
            UPDATE public.kakao_senders SET tip_until = now() + interval '30 minutes' WHERE sender_key = skey;
        END IF;
        RETURN jsonb_build_object('ok', true, 'agreed', ok_agreed);
    ELSIF p_action = 'status' THEN
        RETURN jsonb_build_object('ok', true, 'agreed', ok_agreed);
    ELSIF p_action NOT IN ('image', 'text') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'bad_input');
    END IF;

    IF NOT ok_agreed THEN
        RETURN jsonb_build_object('ok', false, 'agreed', false, 'error', 'not_agreed');
    END IF;
    IF tip IS NULL OR tip <= now() THEN
        RETURN jsonb_build_object('ok', false, 'agreed', true, 'error', 'not_tip');
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
            UPDATE public.kakao_senders SET tip_until = now() + interval '30 minutes' WHERE sender_key = skey;
            RETURN jsonb_build_object('ok', true, 'agreed', true, 'id', last_row.id, 'attached', true);
        END IF;
    END IF;

    IF (SELECT count(*) FROM public.leaflet_submissions WHERE sender_key = skey AND created_at > now() - interval '1 day') >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'agreed', true, 'error', 'daily_limit');
    END IF;
    IF (SELECT count(*) FROM public.leaflet_submissions WHERE channel = 'kakao_bot' AND created_at > now() - interval '1 day') >= 60 THEN
        RETURN jsonb_build_object('ok', false, 'agreed', true, 'error', 'site_limit');
    END IF;

    SELECT user_id INTO member FROM public.kakao_member_links WHERE sender_key = skey;
    new_id := gen_random_uuid();
    path := CASE WHEN p_action = 'image' THEN 'kakao/' || new_id::text || '.jpg' END;
    INSERT INTO public.leaflet_submissions (id, user_id, channel, sender_key, image_path, image_kind, group_name, note, rights_version)
    VALUES (new_id, member, 'kakao_bot', skey, path, 'photo', NULL, nullif(t, ''), agreed);
    UPDATE public.kakao_senders SET tip_until = now() + interval '30 minutes' WHERE sender_key = skey;
    RETURN jsonb_build_object('ok', true, 'agreed', true, 'id', new_id, 'image_path', path);
END;
$$;
REVOKE ALL ON FUNCTION public.kakao_intake(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.kakao_intake(text, text, text, text, text) TO anon;
