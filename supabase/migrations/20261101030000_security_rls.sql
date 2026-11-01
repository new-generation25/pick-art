-- 0단계 보안 정비: "Allow All" 정책을 걷어내고 역할별로 나눈다.
--   익명(anon)       : 공개된 행사(events.status='PUBLISHED')만 읽는다. 구독·키워드 알림은 아래 함수로만 등록한다.
--   로그인(authenticated): 자기 프로필만 읽고 쓴다. role 은 바꿀 수 없다.
--   관리자(profiles.role='admin'): 행사·수집 원본·출처·로그·설정·구독자를 읽고 쓴다.
--   수집기(service_role): RLS 를 거치지 않으므로 영향 없음.

-- 관리자 판정. SECURITY DEFINER 로 profiles RLS 를 거치지 않고 본다(정책 안에서 재귀 방지)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 1. events: 공개분은 누구나 읽고, 나머지(예약·쓰기)는 관리자
DROP POLICY IF EXISTS "Allow All" ON public.events;
DROP POLICY IF EXISTS "Public read published events" ON public.events;
DROP POLICY IF EXISTS "Admin manage events" ON public.events;
CREATE POLICY "Public read published events" ON public.events
    FOR SELECT USING (status = 'PUBLISHED' OR public.is_admin());
CREATE POLICY "Admin manage events" ON public.events
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2. 관리자 전용 테이블
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['raw_posts', 'whitelist', 'blacklist', 'crawl_logs', 'configs', 'crawler_configs', 'subscribers', 'keywords']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow All" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Admin only" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Admin only" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
    END LOOP;
END $$;

-- 3. profiles: 기존 '본인만' 정책은 둔다. 관리자는 전체를 읽는다. role 은 관리자만 바꿀 수 있다
DROP POLICY IF EXISTS "Admin read profiles" ON public.profiles;
CREATE POLICY "Admin read profiles" ON public.profiles
    FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    -- 대시보드·service_role(auth.uid() 없음)은 그대로 둔다. 로그인 사용자는 관리자가 아니면 role 을 못 바꾼다
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
        IF TG_OP = 'INSERT' THEN
            NEW.role := 'user';
        ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
            NEW.role := OLD.role;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 4. 구독·키워드 알림 등록: 표를 열지 않고 함수로만 받는다(이메일 목록을 읽거나 지울 수 없게)
CREATE OR REPLACE FUNCTION public.subscribe_newsletter(p_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
    INSERT INTO public.subscribers (email, is_active) VALUES (lower(trim(p_email)), true)
    ON CONFLICT (email) DO UPDATE SET is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.add_keyword_alerts(p_email text, p_keywords text[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
    INSERT INTO public.keywords (email, keyword)
    SELECT lower(trim(p_email)), trim(k) FROM unnest(p_keywords) AS k WHERE trim(k) <> ''
    ON CONFLICT (email, keyword) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.subscribe_newsletter(text) FROM public;
REVOKE ALL ON FUNCTION public.add_keyword_alerts(text, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_keyword_alerts(text, text[]) TO anon, authenticated;

-- 5. Storage: 직접등록 화면의 이미지 올리기는 관리자만
DROP POLICY IF EXISTS "Upload event-images" ON storage.objects;
CREATE POLICY "Upload event-images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'event-images' AND public.is_admin());

-- 6. 저장공간 보고 함수는 관리자 화면 전용으로 좁힌다
-- (Supabase 는 함수에 PUBLIC 실행 권한을 기본으로 주므로 PUBLIC 에서도 거둔다)
REVOKE EXECUTE ON FUNCTION public.storage_usage() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.ended_events_report() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.storage_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ended_events_report() TO authenticated;
