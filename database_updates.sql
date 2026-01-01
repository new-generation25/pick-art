-- Database Updates for Gyeongnam Art Navigator
-- Run this in your Supabase SQL Editor

-- 1. Table: subscribers (Newsletter)
CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unsubscribed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON public.subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON public.subscribers(is_active) WHERE is_active = true;

-- 2. Table: keywords (User Notification Settings)
CREATE TABLE IF NOT EXISTS public.keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    regions TEXT[], -- ['창원', '김해']
    categories TEXT[], -- ['전시', '공연']
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keywords_user ON public.keywords(user_id);
CREATE INDEX IF NOT EXISTS idx_keywords_active ON public.keywords(is_active) WHERE is_active = true;

-- 3. Table: notification_logs (Audit Trail)
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL, -- 'telegram' | 'kakao' | 'push' | 'email'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'SENT', -- SENT | FAILED | PENDING
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_event ON public.notification_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON public.notification_logs(user_id);

-- 4. Table: whitelist
CREATE TABLE IF NOT EXISTS public.whitelist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'account' | 'domain'
    value TEXT NOT NULL UNIQUE,
    auto_approve BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. RLS Policies for New Tables
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelist ENABLE ROW LEVEL SECURITY;

-- Subscribers: Public can join, Admin can manage
CREATE POLICY "Anyone can subscribe" ON public.subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can view subscribers" ON public.subscribers FOR ALL USING (auth.role() = 'service_role');

-- Keywords: Users can manage their own
CREATE POLICY "Users can manage own keywords" ON public.keywords FOR ALL USING (auth.uid() = user_id);
