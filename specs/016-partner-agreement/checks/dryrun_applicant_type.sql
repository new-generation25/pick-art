DO $outer$
DECLARE r jsonb := '{}'; uid uuid; v uuid; t text;
  payload jsonb := '{"org_name":"ZZ dryrun atype","official_url":"https://example.org/zz","contact_private":"zz-dryrun-atype@example.org","agree_listing":true,"agree_collect":true,"image_use":"yes","agree_confirm":true,"agree_privacy":true,"extras":{},"terms_version":"2026-11-28-draft"}';
BEGIN
  EXECUTE $mig$-- 협약 신청에서 개인과 단체를 구분한다 (specs/016 덧붙임)
--   운영자 2026-11-28 «파트너 협약할때 단체인지 개인인지 구분하는게 좋을까?» → «넣어».
--   그때까지 협약을 맺은 4곳이 모두 «단체»로 저장돼 있었는데 화가 개인도 있었다(단체 표의 구분값에 «개인»이 없었음).
--   1) partner_agreements.applicant_type: 'person'(개인: 작가·연주자) / 'org'(단체·공간). 예전 신청은 NULL 그대로 둔다.
--   2) orgs.kind 에 «개인»을 더한다. 운영자가 «협약 확인»으로 새 줄을 만들 때 신청의 구분을 따른다.
--   3) submit_partner_agreement(): applicant_type 을 받아 저장한다. 값이 없거나 다른 값이면 NULL(예전 화면과도 맞게).
-- 되돌리기: UPDATE public.orgs SET kind = '단체' WHERE kind = '개인';
--           ALTER TABLE public.orgs DROP CONSTRAINT orgs_kind_check;
--           ALTER TABLE public.orgs ADD CONSTRAINT orgs_kind_check CHECK (kind IN ('기관', '단체', '계정'));
--           ALTER TABLE public.partner_agreements DROP COLUMN applicant_type;
--           supabase/migrations/20261127180000_agreement_login_required.sql 의 함수 정의를 다시 실행한다.
ALTER TABLE public.partner_agreements
    ADD COLUMN IF NOT EXISTS applicant_type text CHECK (applicant_type IS NULL OR applicant_type IN ('person', 'org'));

ALTER TABLE public.orgs DROP CONSTRAINT IF EXISTS orgs_kind_check;
ALTER TABLE public.orgs ADD CONSTRAINT orgs_kind_check CHECK (kind IN ('기관', '단체', '계정', '개인'));

CREATE OR REPLACE FUNCTION public.submit_partner_agreement(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    uid uuid := auth.uid();
    new_id uuid;
    contact text := btrim(coalesce(p->>'contact_private', ''));
    oname text := btrim(coalesce(p->>'org_name', ''));
    atype text := CASE WHEN p->>'applicant_type' IN ('person', 'org') THEN p->>'applicant_type' ELSE NULL END;
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
        agree_listing, agree_collect, image_use, agree_confirm, agree_privacy, extras, terms_version, applicant_type)
    VALUES (
        uid, oname, nullif(btrim(coalesce(p->>'representative', '')), ''), nullif(btrim(coalesce(p->>'reg_no', '')), ''),
        btrim(coalesce(p->>'official_url', '')), nullif(p->>'insta_handle', ''), nullif(p->>'region', ''), contact,
        nullif(btrim(coalesce(p->>'contact_public', '')), ''),
        coalesce((p->>'agree_listing')::boolean, false), coalesce((p->>'agree_collect')::boolean, false),
        coalesce(p->>'image_use', ''), coalesce((p->>'agree_confirm')::boolean, false), coalesce((p->>'agree_privacy')::boolean, false),
        CASE WHEN jsonb_typeof(p->'extras') = 'object' THEN p->'extras' ELSE '{}'::jsonb END,
        coalesce(p->>'terms_version', ''), atype)
    RETURNING id INTO new_id;   -- 필수 동의·칸 길이는 표의 CHECK 가 막는다
    RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_partner_agreement(jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.submit_partner_agreement(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_partner_agreement(jsonb) TO authenticated;
$mig$;
  SELECT id INTO uid FROM auth.users ORDER BY created_at LIMIT 1;
  r := r || jsonb_build_object('old_rows_null', (SELECT count(*) FROM public.partner_agreements WHERE applicant_type IS NULL));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v := public.submit_partner_agreement(payload || '{"applicant_type":"person"}');
  EXECUTE 'RESET ROLE';
  SELECT applicant_type INTO t FROM public.partner_agreements WHERE id = v;
  r := r || jsonb_build_object('person_saved', t);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v := public.submit_partner_agreement(jsonb_set(payload, '{org_name}', '"ZZ dryrun atype 2"') || '{"applicant_type":"weird"}');
  EXECUTE 'RESET ROLE';
  SELECT coalesce(applicant_type, '(null)') INTO t FROM public.partner_agreements WHERE id = v;
  r := r || jsonb_build_object('weird_saved', t);
  BEGIN
    INSERT INTO public.orgs (name, norm_name, kind) VALUES ('ZZ dry 개인', 'zzdry개인', '개인');
    r := r || jsonb_build_object('org_kind_person', 'ok');
  EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('org_kind_person', SQLERRM); END;
  BEGIN
    INSERT INTO public.orgs (name, norm_name, kind) VALUES ('ZZ dry 엉뚱', 'zzdry엉뚱', '엉뚱');
    r := r || jsonb_build_object('org_kind_bad', 'INSERTED (bad)');
  EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('org_kind_bad', 'refused'); END;
  RAISE EXCEPTION 'DRYATYPE %', r::text;
END $outer$;
