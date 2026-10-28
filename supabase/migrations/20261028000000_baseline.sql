-- Baseline schema for a fresh Supabase project (2026-10-28)
-- Replaces supabase/migrations_legacy/* which could not build an empty DB
-- (profiles / crawl_logs / crawler_configs were ALTERed but never CREATEd).
-- Columns follow what frontend/src and collector/{main,database,public_scraper,kopis_scraper}.py actually read and write.

-- 1. raw_posts: collected originals (inbox)
CREATE TABLE IF NOT EXISTS public.raw_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    content JSONB NOT NULL,
    image_urls TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'COLLECTED', -- COLLECTED | PENDING | PUBLISHED | REJECTED
    collected_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (source, source_id)
);
CREATE INDEX IF NOT EXISTS idx_raw_posts_source_url ON public.raw_posts (source_url);
CREATE INDEX IF NOT EXISTS idx_raw_posts_collected_at ON public.raw_posts (collected_at DESC);

-- 2. events: published events
-- event_date_* stay TEXT: the admin forms insert '' when a date is empty
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
    is_free BOOLEAN DEFAULT false,
    poster_image_url TEXT,
    source TEXT,
    original_url TEXT,
    status TEXT DEFAULT 'PUBLISHED', -- PUBLISHED | SCHEDULED
    published_at TIMESTAMPTZ DEFAULT now(),
    scheduled_at TIMESTAMPTZ,
    raw_post_id UUID REFERENCES public.raw_posts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_published_at ON public.events (published_at DESC);

-- 3. whitelist / blacklist: sources
CREATE TABLE IF NOT EXISTS public.whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- webpage | instagram | facebook | source | user
    value TEXT UNIQUE NOT NULL,
    name TEXT,
    auto_publish BOOLEAN DEFAULT false,
    schedule TEXT DEFAULT 'daily',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- source | user | keyword | domain
    value TEXT UNIQUE NOT NULL,
    name TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. crawl_logs: run log and manual request queue
CREATE TABLE IF NOT EXISTS public.crawl_logs (
    id BIGSERIAL PRIMARY KEY,
    target_name TEXT NOT NULL,
    status TEXT DEFAULT 'RUNNING', -- REQUESTED | RUNNING | SUCCESS | FAIL | CANCELLED
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    result_summary TEXT,
    error_msg TEXT,
    detailed_log TEXT
);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_status ON public.crawl_logs (status);

-- 5. configs / crawler_configs
CREATE TABLE IF NOT EXISTS public.configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crawler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL,
    name TEXT NOT NULL,
    identifier TEXT NOT NULL UNIQUE,
    keywords TEXT[],
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. profiles: id = auth uid
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname TEXT,
    phone TEXT,
    region TEXT,
    interests TEXT[] DEFAULT '{}',
    email_notifications BOOLEAN DEFAULT true,
    new_event_notifications BOOLEAN DEFAULT true,
    role TEXT DEFAULT 'user', -- 'admin' unlocks admin menu in Header.tsx
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ
);

-- 7. subscribers / keywords
CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    subscribed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    keyword TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (email, keyword)
);

-- 8. RLS
-- Same open policies as the previous local setup: the admin UI writes with the anon key.
-- TODO before public launch: restrict writes to admins (see plan, out of scope).
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['raw_posts','events','whitelist','blacklist','crawl_logs','configs','crawler_configs','subscribers','keywords']
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow All" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Allow All" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 9. Storage buckets: posters (collector), event-images (admin manual upload)
INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', true), ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read pick-art buckets" ON storage.objects;
CREATE POLICY "Public read pick-art buckets" ON storage.objects
    FOR SELECT USING (bucket_id IN ('posters', 'event-images'));
DROP POLICY IF EXISTS "Upload event-images" ON storage.objects;
CREATE POLICY "Upload event-images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'event-images');

-- 10. Default AI prompt (moved from legacy create_configs_table.sql)
INSERT INTO public.configs (key, value, description)
VALUES (
    'ai_prompt',
    'Role: You are an expert Cultural Event Information Extractor specialized in Korean cultural events.

Task: Analyze the provided text and image (poster) to extract structured event data with high accuracy.

CRITICAL RULES:
1. Extract information EXACTLY as written - do not invent or guess dates/times/prices
2. If information is missing, use null (NOT "정보 없음" or empty strings)
3. Dates MUST be in YYYY-MM-DD format or null
4. Title should be clean and descriptive (remove emoji, remove source prefixes like "[페이스북]")
5. Description should preserve original formatting and line breaks
6. Region inference priority: venue name > address > context clues

Extraction Guidelines:

**Title Extraction:**
- Remove source indicators: "[Facebook]" "[Instagram]" "@username"
- Remove excessive emoji (keep 1-2 if meaningful)
- Example: "🎨[경남문화재단] 봄맞이 전시회" → "봄맞이 전시회"

**Date/Time Extraction:**
- Look for: "YYYY.MM.DD", "MM월 DD일", "~까지", "부터"
- If range: extract both date_start and date_end
- If single day: date_start = date_end
- If no date found: null (DO NOT guess)

**Venue & Region:**
- venue: Specific place name ("경남도립미술관", "성산아트홀")
- region: City from [창원, 김해, 진주, 통영, 거제, 양산, 밀양, 함안, 기타]
- Inference: "창원 성산아트홀" → region: "창원", venue: "성산아트홀"

**Category Classification:**
Choose EXACTLY ONE from: [전시, 공연, 축제, 전통문화, 체험/교육, 기타]
- 전시: 미술, 사진, 조각 등 전시회
- 공연: 연극, 뮤지컬, 콘서트, 무용
- 축제: 지역 축제, 문화제
- 전통문화: 국악, 전통예술
- 체험/교육: 워크샵, 강연, 교육 프로그램

**Price Information:**
- is_free: true if "무료", "입장료 없음", "free"
- price_details: Exact text ("5,000원", "성인 10,000원 / 청소년 5,000원")

**Tags Generation:**
Create 5 relevant hashtags:
- 1 region tag: "#창원" "#김해"
- 1-2 category tags: "#전시" "#공연" "#축제"
- 2-3 theme/audience tags: "#가족" "#주말" "#무료" "#현대미술"

Required JSON Output:
{
    "title": "string",
    "description": "string",
    "category": "전시|공연|축제|전통문화|체험/교육|기타",
    "region": "창원|김해|진주|통영|거제|양산|밀양|함안|기타",
    "venue": "string or null",
    "date_start": "YYYY-MM-DD or null",
    "date_end": "YYYY-MM-DD or null",
    "is_free": boolean,
    "price_details": "string or null",
    "contact": "string or null",
    "organizer": "string or null",
    "tags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

Return ONLY valid JSON. No markdown, no explanations, no extra text.',
    'Gemini AI prompt for extracting cultural event metadata'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
