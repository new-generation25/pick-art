-- 오류 신고·행사 제보 (specs/007-report-tip)
--   kind     : 'error'(행사 상세의 「정보가 틀렸어요」) | 'tip'(「행사 제보하기」)
--   category : error 일 때 무엇이 틀렸는지(날짜·시간 / 장소 / 관람료 / 링크 / 취소·변경 / 기타)
--   tip      : tip 일 때 {title, date_start, date_end, venue, region, url}
--   status   : 'new' → 관리자가 'done'(반영) 또는 'rejected'(반영 안 함)
-- 로그인 회원(구글·카카오)만 보낸다. 공개 피드에는 관리자가 확인·반영한 뒤에만 나간다(헌장 I).
-- RLS: 회원은 자기 것만 넣고 읽는다(하루 10건 한도). 관리자는 모두 읽고 처리한다. 익명은 아무것도 못 한다.
-- 되돌리기: DROP TABLE public.reports;

CREATE TABLE IF NOT EXISTS public.reports (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind        text NOT NULL CHECK (kind IN ('error', 'tip')),
    event_id    uuid REFERENCES public.events(id) ON DELETE SET NULL,
    user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    category    text,
    body        text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 2000),
    tip         jsonb,
    status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done', 'rejected')),
    admin_note  text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    handled_at  timestamptz,
    CONSTRAINT reports_error_has_event CHECK (kind <> 'error' OR event_id IS NOT NULL),
    CONSTRAINT reports_tip_has_fields CHECK (kind <> 'tip' OR (tip ? 'title' AND tip ? 'url'))
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_user_idx ON public.reports (user_id, created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 하루 한도를 정책 안에서 세려면 RLS 를 거치지 않는 함수가 필요하다(자기 행만 센다)
CREATE OR REPLACE FUNCTION public.my_reports_today() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT count(*)::int FROM public.reports WHERE user_id = auth.uid() AND created_at > now() - interval '1 day'
$$;
REVOKE ALL ON FUNCTION public.my_reports_today() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_reports_today() TO authenticated;

DROP POLICY IF EXISTS "Member insert own report" ON public.reports;
CREATE POLICY "Member insert own report" ON public.reports
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND status = 'new' AND admin_note IS NULL AND handled_at IS NULL
                AND public.my_reports_today() < 10);

DROP POLICY IF EXISTS "Member read own report" ON public.reports;
CREATE POLICY "Member read own report" ON public.reports
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin update report" ON public.reports;
CREATE POLICY "Admin update report" ON public.reports
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
