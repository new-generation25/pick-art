-- 찜 (specs/008-saved-calendar): 로그인 회원이 행사에 찜 표시. 자기 것만 보고 넣고 뺀다
-- 되돌리기: DROP TABLE public.favorites;

CREATE TABLE IF NOT EXISTS public.favorites (
    user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS favorites_event_idx ON public.favorites (event_id);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own favorites read" ON public.favorites;
CREATE POLICY "Own favorites read" ON public.favorites
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Own favorites insert" ON public.favorites;
CREATE POLICY "Own favorites insert" ON public.favorites
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Own favorites delete" ON public.favorites;
CREATE POLICY "Own favorites delete" ON public.favorites
    FOR DELETE TO authenticated USING (user_id = auth.uid());
