-- 행사별 조회·클릭 집계(specs/011)와 단체 묶음(specs/012). 운영자 11/26 「모두 진행해」(시장조사 세션에서 입력, 기록 확인)
--
-- event_counts_daily : 행사·날짜·종류별 숫자 하나. 사람·기기·IP·쿠키·로그인 정보는 저장하지 않는다(«날짜별 숫자만 센다»)
--   kind: view(상세 조회) · outbound(원본 안내 페이지 열기) · calendar(캘린더 추가) · share(공유)
--   읽기: 관리자만. 쓰기: count_event() 함수로만(공개 행사만, 관리자 접속은 세지 않음)
--   한계: 누구나 부를 수 있는 함수라 일부러 부풀리는 것은 막지 못한다 → 증빙은 «근사치»로 표기
-- orgs / event_orgs : 단체(주최·주관 기관, 공연 단체, 인스타 계정)와 행사의 연결. 공개 정보라 누구나 읽는다(공개 행사 연결만)
--   쓰기: 수집기(service 키)와 관리자
-- 되돌리기: DROP FUNCTION public.count_event(uuid, text); DROP TABLE public.event_orgs, public.orgs, public.event_counts_daily;

-- ---------- 011 ----------
CREATE TABLE IF NOT EXISTS public.event_counts_daily (
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    day      date NOT NULL,
    kind     text NOT NULL CHECK (kind IN ('view', 'outbound', 'calendar', 'share')),
    n        integer NOT NULL DEFAULT 0 CHECK (n >= 0),
    PRIMARY KEY (event_id, day, kind)
);

ALTER TABLE public.event_counts_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read event counts" ON public.event_counts_daily;
CREATE POLICY "Admin read event counts" ON public.event_counts_daily
    FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.count_event(p_event uuid, p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_kind NOT IN ('view', 'outbound', 'calendar', 'share') THEN RETURN; END IF;
    IF public.is_admin() THEN RETURN; END IF;  -- 운영자 확인 접속은 세지 않는다
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event AND status = 'PUBLISHED') THEN RETURN; END IF;
    INSERT INTO public.event_counts_daily (event_id, day, kind, n)
    VALUES (p_event, (now() AT TIME ZONE 'Asia/Seoul')::date, p_kind, 1)
    ON CONFLICT (event_id, day, kind) DO UPDATE SET n = public.event_counts_daily.n + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.count_event(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.count_event(uuid, text) TO anon, authenticated;

-- ---------- 012 ----------
CREATE TABLE IF NOT EXISTS public.orgs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    norm_name    text NOT NULL UNIQUE,   -- 띄어쓰기·(재)·괄호·기호를 지운 글자. 이름 맞추기용
    kind         text NOT NULL CHECK (kind IN ('기관', '단체', '계정')),
    insta_handle text UNIQUE,
    small        boolean NOT NULL DEFAULT false,  -- 소규모(작가·단체 계정): 동의 전에는 페이지를 검색에 올리지 않는다
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_orgs (
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    org_id   uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    role     text NOT NULL CHECK (role IN ('주최', '주관', '기획', '제작', '게시')),
    PRIMARY KEY (event_id, org_id, role)
);
CREATE INDEX IF NOT EXISTS event_orgs_org_idx ON public.event_orgs (org_id);

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_orgs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read orgs" ON public.orgs;
CREATE POLICY "Public read orgs" ON public.orgs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admin write orgs" ON public.orgs;
CREATE POLICY "Admin write orgs" ON public.orgs FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 연결은 공개된 행사 것만 보인다(events 의 RLS 가 비공개 행사를 가린다)
DROP POLICY IF EXISTS "Public read event_orgs" ON public.event_orgs;
CREATE POLICY "Public read event_orgs" ON public.event_orgs FOR SELECT TO anon, authenticated
    USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id));
DROP POLICY IF EXISTS "Admin write event_orgs" ON public.event_orgs;
CREATE POLICY "Admin write event_orgs" ON public.event_orgs FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());
