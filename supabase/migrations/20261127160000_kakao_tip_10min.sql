-- specs/017 보완: 제보 시간 30분 → 10분 (운영자 11/27 «30분 너무 길에 10분으로 줄여»).
-- «행사 제보하기»(옛 «행사 알리기»)·동의·제보 저장 때 tip_until 을 now()+10분으로 둔다. 나머지는 20261127150000 과 같다.
-- 되돌리기: 20261127150000_kakao_member_link.sql 의 kakao_intake 를 다시 실행.

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
        INSERT INTO public.kakao_senders (sender_key, rights_version, tip_until) VALUES (skey, p_rights, now() + interval '10 minutes')
        ON CONFLICT (sender_key) DO UPDATE SET rights_version = EXCLUDED.rights_version, agreed_at = now(), tip_until = EXCLUDED.tip_until;
        RETURN jsonb_build_object('ok', true, 'agreed', true);
    ELSIF p_action = 'start' THEN
        -- 동의한 사람만 제보 시간을 연다. 동의 전이면 agreed=false 를 돌려주고 서버가 동의 안내를 보인다
        IF ok_agreed THEN
            UPDATE public.kakao_senders SET tip_until = now() + interval '10 minutes' WHERE sender_key = skey;
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
            UPDATE public.kakao_senders SET tip_until = now() + interval '10 minutes' WHERE sender_key = skey;
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
    UPDATE public.kakao_senders SET tip_until = now() + interval '10 minutes' WHERE sender_key = skey;
    RETURN jsonb_build_object('ok', true, 'agreed', true, 'id', new_id, 'image_path', path);
END;
$$;
REVOKE ALL ON FUNCTION public.kakao_intake(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.kakao_intake(text, text, text, text, text) TO anon;
