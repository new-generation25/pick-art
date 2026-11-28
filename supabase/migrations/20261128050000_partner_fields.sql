-- 협약 신청에 «활동 분야(선택)»를 받는다 (specs/016 덧붙임)
--   운영자 2026-11-28 «장르 물어보는 (선택) 항목도 넣어» (피카 디자인 세션에서 받아 넘김).
--   1) partner_agreements.fields text[]: 고른 분야(여러 개, 없으면 빈 배열). 자유 글은 받지 않는다.
--   2) submit_partner_agreement(): p->'fields' 배열에서 아래 allowed 목록에 있는 값만 저장한다(최대 22개, 화면은 하나만 고르게 한다).
--      목록은 frontend/src/lib/partnerAgreement.ts ACTIVITY_FIELDS 와 같다. 한쪽을 고치면 다른 쪽도 고친다.
--   예전 화면(fields 를 보내지 않음)도 그대로 동작한다(빈 배열).
-- 되돌리기: supabase/migrations/20261128030000_partner_applicant_type.sql 의 함수 정의를 다시 실행하고
--           ALTER TABLE public.partner_agreements DROP COLUMN fields;
ALTER TABLE public.partner_agreements
    ADD COLUMN IF NOT EXISTS fields text[] NOT NULL DEFAULT '{}' CHECK (cardinality(fields) <= 22);

CREATE OR REPLACE FUNCTION public.submit_partner_agreement(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    uid uuid := auth.uid();
    new_id uuid;
    contact text := btrim(coalesce(p->>'contact_private', ''));
    oname text := btrim(coalesce(p->>'org_name', ''));
    atype text := CASE WHEN p->>'applicant_type' IN ('person', 'org') THEN p->>'applicant_type' ELSE NULL END;
    allowed text[] := ARRAY['연극', '뮤지컬', '클래식·오페라', '국악·전통연희', '대중음악', '무용', '서커스·마술',
                            '회화·드로잉', '사진', '조각·설치', '미디어', '공예', '디자인·건축', '서예',
                            '축제', '강연·북토크', '상영회', '마켓', '체험·워크숍', '교육·강좌', '기획', '기타'];
    picked text[] := ARRAY[]::text[];
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
    IF jsonb_typeof(p->'fields') = 'array' THEN
        SELECT coalesce(array_agg(a ORDER BY array_position(allowed, a)), ARRAY[]::text[]) INTO picked
        FROM (SELECT DISTINCT x AS a FROM jsonb_array_elements_text(p->'fields') AS x WHERE x = ANY (allowed)) s;
    END IF;
    INSERT INTO public.partner_agreements (
        user_id, org_name, representative, reg_no, official_url, insta_handle, region, contact_private, contact_public,
        agree_listing, agree_collect, image_use, agree_confirm, agree_privacy, extras, terms_version, applicant_type, fields)
    VALUES (
        uid, oname, nullif(btrim(coalesce(p->>'representative', '')), ''), nullif(btrim(coalesce(p->>'reg_no', '')), ''),
        btrim(coalesce(p->>'official_url', '')), nullif(p->>'insta_handle', ''), nullif(p->>'region', ''), contact,
        nullif(btrim(coalesce(p->>'contact_public', '')), ''),
        coalesce((p->>'agree_listing')::boolean, false), coalesce((p->>'agree_collect')::boolean, false),
        coalesce(p->>'image_use', ''), coalesce((p->>'agree_confirm')::boolean, false), coalesce((p->>'agree_privacy')::boolean, false),
        CASE WHEN jsonb_typeof(p->'extras') = 'object' THEN p->'extras' ELSE '{}'::jsonb END,
        coalesce(p->>'terms_version', ''), atype, picked)
    RETURNING id INTO new_id;   -- 필수 동의·칸 길이는 표의 CHECK 가 막는다
    RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_partner_agreement(jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.submit_partner_agreement(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_partner_agreement(jsonb) TO authenticated;
