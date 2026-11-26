-- specs/016 정식 협약(정보 제공 동의) 온라인 신청. 운영자 11/26 «동의 페이지를 통한 동의(정식 협약) 수집»
--   단체가 /partners/join 에서 동의서(docs/partner/동의서_초안.md, 문구는 frontend/src/lib/partnerAgreement.ts)를 읽고 보낸다.
--   status: new(검토 대기) → confirmed(협약 확인, orgs.partner_since 설정) | rejected(반려) | withdrawn(철회 처리)
--   담당자 연락처(contact_private)는 관리자만 본다. 공개 화면·단체 페이지에 내보내지 않는다.
-- RLS(007·013과 같은 기준): 로그인 회원은 자기 것만 넣고 읽는다(하루 3건). 관리자는 모두 읽고 고친다. 익명은 아무것도 못 한다.
-- 되돌리기: DROP FUNCTION public.request_partner_withdrawal(uuid); DROP FUNCTION public.my_partner_agreements_today();
--           DROP TABLE public.partner_agreements;

CREATE TABLE IF NOT EXISTS public.partner_agreements (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    org_name           text NOT NULL CHECK (char_length(btrim(org_name)) BETWEEN 1 AND 120),
    representative     text NOT NULL CHECK (char_length(btrim(representative)) BETWEEN 1 AND 60),
    reg_no             text CHECK (reg_no IS NULL OR char_length(reg_no) <= 30),
    official_url       text NOT NULL CHECK (official_url ~* '^https?://' AND char_length(official_url) <= 500),
    insta_handle       text CHECK (insta_handle IS NULL OR insta_handle ~ '^[a-z0-9._]{1,30}$'),
    region             text CHECK (region IS NULL OR char_length(region) <= 30),
    contact_private    text NOT NULL CHECK (char_length(btrim(contact_private)) BETWEEN 3 AND 200),
    contact_public     text CHECK (contact_public IS NULL OR char_length(contact_public) <= 200),
    agree_listing      boolean NOT NULL CHECK (agree_listing),   -- 1 정보 게재(필수)
    agree_collect      boolean NOT NULL CHECK (agree_collect),   -- 2 자동 수집(필수)
    image_use          text NOT NULL CHECK (image_use IN ('yes', 'no')),  -- 3 이미지 사용 동의/비동의
    agree_confirm      boolean NOT NULL CHECK (agree_confirm),   -- 단체가 확인할 것(필수)
    agree_privacy      boolean NOT NULL CHECK (agree_privacy),   -- 담당자 연락처 수집·이용(필수)
    extras             jsonb NOT NULL DEFAULT '{}'::jsonb,       -- 5 선택: {monthly_report, grant_alerts, grant_profile}
    terms_version      text NOT NULL CHECK (char_length(terms_version) BETWEEN 1 AND 40),
    status             text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'rejected', 'withdrawn')),
    org_id             uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
    admin_note         text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    handled_at         timestamptz,
    withdraw_requested_at timestamptz
);

CREATE INDEX IF NOT EXISTS partner_agreements_status_idx ON public.partner_agreements (status, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_agreements_user_idx ON public.partner_agreements (user_id, created_at DESC);

ALTER TABLE public.partner_agreements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.my_partner_agreements_today() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT count(*)::int FROM public.partner_agreements WHERE user_id = auth.uid() AND created_at > now() - interval '1 day'
$$;
REVOKE ALL ON FUNCTION public.my_partner_agreements_today() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_partner_agreements_today() TO authenticated;

DROP POLICY IF EXISTS "Member insert own agreement" ON public.partner_agreements;
CREATE POLICY "Member insert own agreement" ON public.partner_agreements
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND status = 'new' AND org_id IS NULL AND admin_note IS NULL
                AND handled_at IS NULL AND withdraw_requested_at IS NULL
                AND public.my_partner_agreements_today() < 3);

DROP POLICY IF EXISTS "Member read own agreement" ON public.partner_agreements;
CREATE POLICY "Member read own agreement" ON public.partner_agreements
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin update agreement" ON public.partner_agreements;
CREATE POLICY "Admin update agreement" ON public.partner_agreements
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 철회 요청: 자기 신청에 시각만 남긴다(상태·단체 표시는 운영자가 7일 안에 바꾼다)
CREATE OR REPLACE FUNCTION public.request_partner_withdrawal(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.partner_agreements SET withdraw_requested_at = now()
     WHERE id = p_id AND user_id = auth.uid() AND status IN ('new', 'confirmed') AND withdraw_requested_at IS NULL;
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.request_partner_withdrawal(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_partner_withdrawal(uuid) TO authenticated;
