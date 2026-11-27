-- 협약 신청은 로그인한 사람만 (specs/023 FR-005)
--   운영자 2026-11-27 «카톡은 채널구독, 피카에서는 로그인»: 사이트에서 보내는 것(제보·리플렛·협약 신청)은 모두 로그인 뒤에 받는다.
--   20261127060000 에서 연 «로그인 없이 신청»을 닫는다. 로그인 없이 이미 받은 신청(user_id NULL)은 그대로 둔다.
-- 되돌리기: supabase/migrations/20261127060000_partner_agreements_anon.sql 의 함수 정의와 GRANT 를 다시 실행한다.
CREATE OR REPLACE FUNCTION public.submit_partner_agreement(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    uid uuid := auth.uid();
    new_id uuid;
    contact text := btrim(coalesce(p->>'contact_private', ''));
    oname text := btrim(coalesce(p->>'org_name', ''));
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'login_required' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.partner_agreements WHERE user_id = uid AND created_at > now() - interval '1 day') >= 3 THEN
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
REVOKE EXECUTE ON FUNCTION public.submit_partner_agreement(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_partner_agreement(jsonb) TO authenticated;
