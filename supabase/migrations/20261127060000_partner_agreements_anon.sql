-- specs/016 보완: 로그인 없이도 협약 신청을 받는다.
--   까닭: 신청하는 사람 대부분이 인스타그램 링크로 들어오는데, 인스타 앱 안 브라우저에서는 구글 로그인이 막힌다
--         (구글은 앱 내장 브라우저의 로그인을 거부한다). 카카오 로그인은 아직 켜지 않았다.
--   방법: 표에 직접 넣는 권한은 그대로 회원만. 익명은 submit_partner_agreement() 함수로만 넣는다.
--         스팸 막기: 로그인하지 않은 신청은 사이트 전체 하루 20건까지, 같은 연락처·이름은 하루 한 번. IP 등 접속 정보는 저장하지 않는다.
--         회원은 지금처럼 하루 3건(user_id 로 «내가 보낸 신청»을 본다).
-- 되돌리기: DROP FUNCTION public.submit_partner_agreement(jsonb);
--           DELETE FROM public.partner_agreements WHERE user_id IS NULL;  (익명 신청을 지워야 NOT NULL 을 되돌릴 수 있다)
--           ALTER TABLE public.partner_agreements ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.partner_agreements ALTER COLUMN user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.submit_partner_agreement(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    uid uuid := auth.uid();
    new_id uuid;
    contact text := btrim(coalesce(p->>'contact_private', ''));
    oname text := btrim(coalesce(p->>'org_name', ''));
BEGIN
    IF uid IS NULL THEN
        IF (SELECT count(*) FROM public.partner_agreements WHERE user_id IS NULL AND created_at > now() - interval '1 day') >= 20 THEN
            RAISE EXCEPTION 'daily_limit' USING ERRCODE = 'P0001';
        END IF;
    ELSIF (SELECT count(*) FROM public.partner_agreements WHERE user_id = uid AND created_at > now() - interval '1 day') >= 3 THEN
        RAISE EXCEPTION 'daily_limit' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.partner_agreements
               WHERE lower(contact_private) = lower(contact) AND lower(org_name) = lower(oname)
                 AND created_at > now() - interval '1 day') THEN
        RAISE EXCEPTION 'duplicate' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.partner_agreements (
        user_id, org_name, representative, reg_no, official_url, insta_handle, region, contact_private, contact_public,
        agree_listing, agree_collect, image_use, agree_confirm, agree_privacy, extras, terms_version)
    VALUES (
        uid, oname, nullif(btrim(coalesce(p->>'representative', '')), ''), nullif(btrim(coalesce(p->>'reg_no', '')), ''),
        btrim(coalesce(p->>'official_url', '')), nullif(p->>'insta_handle', ''), nullif(p->>'region', ''), contact,
        nullif(btrim(coalesce(p->>'contact_public', '')), ''),
        coalesce((p->>'agree_listing')::boolean, false), coalesce((p->>'agree_collect')::boolean, false),
        coalesce(p->>'image_use', ''), coalesce((p->>'agree_confirm')::boolean, false), coalesce((p->>'agree_privacy')::boolean, false),
        CASE WHEN jsonb_typeof(p->'extras') = 'object' THEN p->'extras' ELSE '{}'::jsonb END,
        coalesce(p->>'terms_version', ''))
    RETURNING id INTO new_id;   -- 필수 동의·칸 길이는 표의 CHECK 가 막는다
    RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_partner_agreement(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_partner_agreement(jsonb) TO anon, authenticated;
