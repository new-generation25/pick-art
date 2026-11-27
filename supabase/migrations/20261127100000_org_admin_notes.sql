-- specs/019 A0: 단체 메모(협약 확인·철회·해지 기록)를 관리자만 읽는 표로 옮긴다.
-- 이유: orgs 는 «Public read orgs» USING(true) 라 orgs.partner_note 가 로그인하지 않아도 읽혔다(2026-11-27 익명 키로 확인, 값은 모두 NULL).
-- 순서: ① 이 파일(새 표) 적용 → ② 프론트 배포(새 표에 쓰기) → ③ 20261127110000_orgs_drop_partner_note.sql(옛 칸 지우기)
-- 되돌리기: DROP TABLE IF EXISTS public.org_admin_notes;

CREATE TABLE IF NOT EXISTS public.org_admin_notes (
    org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
    note text NOT NULL CHECK (char_length(note) <= 2000),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin all org_admin_notes" ON public.org_admin_notes;
CREATE POLICY "Admin all org_admin_notes" ON public.org_admin_notes
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.org_admin_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_admin_notes TO authenticated;

-- 옛 칸에 값이 있으면 옮긴다(지금은 0건)
INSERT INTO public.org_admin_notes (org_id, note)
SELECT id, partner_note FROM public.orgs WHERE partner_note IS NOT NULL
ON CONFLICT (org_id) DO NOTHING;
