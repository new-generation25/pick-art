-- 푸시 알림 (specs/018, 2026-11-27 운영자 «이메일 구독 칸 빼, 푸시 알림이 갈 수 있도록해»)
-- 보내는 것: 찜한 행사 시작 전날 · 금요일 주말 행사 요약(내 지역) · 찜한 장소의 새 행사. 로그인 회원만, 기기마다 구독 하나.
-- 장소 찜(venue_follows): 운영자 11/27 «행사가 열리는 장소에 대한 좋아요도 가능(다음에도 그 장소에서 행사가 생기면 알림)»
--   push_subscriptions : 기기(브라우저)마다 구독 주소. 본인만 넣고·보고·지운다. 보내기는 수집기가 service 키로 읽는다
--   push_sent          : 같은 알림을 두 번 보내지 않게 남기는 기록(관리자·service 키만)
--   profiles.push_favorites / push_weekend : 알림 종류 켜고 끄기(기본 켬)

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint    text NOT NULL UNIQUE,
    p256dh      text NOT NULL,
    auth        text NOT NULL,
    user_agent  text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    last_ok_at  timestamptz,
    fail_count  integer NOT NULL DEFAULT 0,
    CONSTRAINT push_endpoint_https CHECK (endpoint LIKE 'https://%')
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own push read" ON public.push_subscriptions;
CREATE POLICY "Own push read" ON public.push_subscriptions
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Own push insert" ON public.push_subscriptions;
CREATE POLICY "Own push insert" ON public.push_subscriptions
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Own push update" ON public.push_subscriptions;
CREATE POLICY "Own push update" ON public.push_subscriptions
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Own push delete" ON public.push_subscriptions;
CREATE POLICY "Own push delete" ON public.push_subscriptions
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 같은 기기 주소를 다른 회원이 이미 가진 경우(로그인 계정을 바꾼 브라우저): 본인 것으로 옮긴다
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
    ON CONFLICT (endpoint) DO UPDATE
        SET user_id = auth.uid(), p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
            user_agent = EXCLUDED.user_agent, fail_count = 0;
END $$;
REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.push_sent (
    user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind      text NOT NULL CHECK (kind IN ('favorite_eve', 'weekend', 'venue_new')),
    ref       text NOT NULL,            -- favorite_eve·venue_new: 행사 id, weekend: 그 주 금요일 날짜
    sent_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, kind, ref)
);
ALTER TABLE public.push_sent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read push_sent" ON public.push_sent;
CREATE POLICY "Admin read push_sent" ON public.push_sent
    FOR SELECT TO authenticated USING (public.is_admin());

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_favorites boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_weekend boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_venues boolean NOT NULL DEFAULT true;

-- 장소 찜: 본인만 넣고·보고·지운다. 보내기는 수집기가 service 키로 읽는다
CREATE TABLE IF NOT EXISTS public.venue_follows (
    user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    venue_id    uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, venue_id)
);
CREATE INDEX IF NOT EXISTS venue_follows_venue_idx ON public.venue_follows (venue_id);
ALTER TABLE public.venue_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own venue follows read" ON public.venue_follows;
CREATE POLICY "Own venue follows read" ON public.venue_follows
    FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Own venue follows insert" ON public.venue_follows;
CREATE POLICY "Own venue follows insert" ON public.venue_follows
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Own venue follows delete" ON public.venue_follows;
CREATE POLICY "Own venue follows delete" ON public.venue_follows
    FOR DELETE TO authenticated USING (user_id = auth.uid());
