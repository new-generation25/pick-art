-- Gyeongnam Art Navigator Full Local Schema

-- 1. Raw Posts (수집 원본)
CREATE TABLE IF NOT EXISTS public.raw_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_url TEXT UNIQUE NOT NULL,
    content JSONB NOT NULL,
    image_urls TEXT[],
    status TEXT DEFAULT 'COLLECTED',
    collected_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(source, source_id)
);

-- 2. Events (최종 발행 행사)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    region TEXT,
    venue TEXT,
    event_date_start TEXT,
    event_date_end TEXT,
    price_info TEXT,
    poster_image_url TEXT,
    source TEXT,
    original_url TEXT,
    status TEXT DEFAULT 'PUBLISHED',
    published_at TIMESTAMPTZ DEFAULT now(),
    scheduled_at TIMESTAMPTZ,
    raw_post_id UUID REFERENCES public.raw_posts(id)
);

-- 3. Subscribers (구독자)
CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Keywords (알림 키워드)
CREATE TABLE IF NOT EXISTS public.keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    keyword TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(email, keyword)
);

-- 5. Whitelist (정보출처)
CREATE TABLE IF NOT EXISTS public.whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    value TEXT UNIQUE NOT NULL,
    name TEXT,
    auto_publish BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Blacklist (차단 목록)
CREATE TABLE IF NOT EXISTS public.blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    value TEXT UNIQUE NOT NULL,
    name TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Notification Logs (알림 로그)
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    event_id UUID REFERENCES public.events(id),
    keyword TEXT,
    status TEXT DEFAULT 'SENT',
    sent_at TIMESTAMPTZ DEFAULT now()
);

-- Dummy RLS (Local only)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON public.events FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.raw_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON public.raw_posts FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON public.subscribers FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON public.keywords FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON public.whitelist FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON public.blacklist FOR ALL USING (true) WITH CHECK (true);
