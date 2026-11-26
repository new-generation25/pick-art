-- specs/017 보완: 카카오톡 채널 «피카»로 오는 말은 제보만이 아니다(운영자 11/26 «일반 사용자들도 있잖아», «제보는 메뉴형태로»).
-- 그래서 «행사 알리기»를 누른 뒤 30분 동안 보낸 사진·글만 제보로 받는다. 그 밖의 말은 저장하지 않고
-- 챗봇이 «운영자에게 문의»(상담 연결 버튼) · «행사 알리기» 두 갈래를 보인다.
--   kakao_senders.tip_until : 이 시각까지 보낸 사진·글을 제보로 받는다. «행사 알리기»·동의·제보 저장 때 now()+30분으로 늘린다
--   kakao_intake(p_action) : start(행사 알리기 누름) 추가. image·text 는 동의 + tip_until > now() 일 때만, 아니면 error not_tip
-- 되돌리기: 20261127070000_kakao_channel_intake.sql 의 kakao_intake 를 다시 실행하고
--           ALTER TABLE public.kakao_senders DROP COLUMN tip_until;

ALTER TABLE public.kakao_senders ADD COLUMN IF NOT EXISTS tip_until timestamptz;

-- p_action: start(행사 알리기) · agree(권리 확인 동의) · image(사진 한 장) · text(글) · status(동의 여부만 묻기)
-- 돌려주는 값: {ok, agreed, id?, image_path?, attached?, error?}  error: auth · not_agreed · not_tip · daily_limit · site_limit · bad_input
CREATE OR REPLACE FUNCTION public.kakao_intake(p_secret text, p_user text, p_action text, p_text text DEFAULT NULL, p_rights text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    skey text;
    agreed text;
    tip timestamptz;
    ok_agreed boolean;
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

    IF p_action = 'agree' THEN
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

    new_id := gen_random_uuid();
    path := CASE WHEN p_action = 'image' THEN 'kakao/' || new_id::text || '.jpg' END;
    INSERT INTO public.leaflet_submissions (id, user_id, channel, sender_key, image_path, image_kind, group_name, note, rights_version)
    VALUES (new_id, NULL, 'kakao_bot', skey, path, 'photo', NULL, nullif(t, ''), agreed);
    UPDATE public.kakao_senders SET tip_until = now() + interval '30 minutes' WHERE sender_key = skey;
    RETURN jsonb_build_object('ok', true, 'agreed', true, 'id', new_id, 'image_path', path);
END;
$$;
REVOKE ALL ON FUNCTION public.kakao_intake(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.kakao_intake(text, text, text, text, text) TO anon;
