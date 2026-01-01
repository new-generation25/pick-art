-- Gyeongnam Art Navigator Database Schema
-- Run this in your Supabase SQL Editor

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Table: raw_posts (Collected data)
CREATE TABLE IF NOT EXISTS public.raw_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL, -- 'instagram' | 'gyeongnam_foundation' | 'changwon_city'
    source_id TEXT NOT NULL, -- Instagram Post ID or Site Board ID
    source_url TEXT NOT NULL UNIQUE, 
    content JSONB NOT NULL, 
    image_urls TEXT[], 
    images_hash TEXT[], 
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'COLLECTED', -- COLLECTED | PROCESSED | FAILED | DUPLICATE
    error_message TEXT,
    CONSTRAINT unique_source_post UNIQUE(source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_raw_posts_status ON public.raw_posts(status);
CREATE INDEX IF NOT EXISTS idx_raw_posts_collected_at ON public.raw_posts(collected_at DESC);

-- 3. Table: events (Curated and published data)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_post_id UUID REFERENCES public.raw_posts(id) ON DELETE SET NULL,

    -- Basic Info
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- '공연' | '전시' | '행사' | '축제' | '강연' | '체험'
    region TEXT NOT NULL, -- '창원' | '김해' | '진주' | '통영' | '거제' | '양산' | '밀양' | '함안' | '기타'
    venue TEXT, 
    venue_address TEXT, 

    -- DateTime
    event_date_start DATE,
    event_date_end DATE,
    event_time_start TIME,
    event_time_end TIME,

    -- Pricing
    price_info TEXT, 
    is_free BOOLEAN DEFAULT false,

    -- Media
    poster_image_url TEXT NOT NULL, 
    poster_thumbnail_url TEXT, 
    additional_images TEXT[], 

    -- Source
    source TEXT NOT NULL, 
    source_author TEXT, 
    original_url TEXT NOT NULL, 

    -- Booking
    booking_url TEXT, 
    booking_platform TEXT, 

    -- Workflow Status
    status TEXT DEFAULT 'CANDIDATE',
    -- CANDIDATE | DM_PENDING | CONTACTED | APPROVED | PUBLISHED | REJECTED | ARCHIVED
    admin_notes TEXT, 
    rejection_reason TEXT, 

    -- Publishing
    published_at TIMESTAMP WITH TIME ZONE,
    scheduled_publish_at TIMESTAMP WITH TIME ZONE, 
    view_count INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('CANDIDATE', 'DM_PENDING', 'CONTACTED', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_published ON public.events(published_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_events_region ON public.events(region);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);

-- 4. Blacklist
CREATE TABLE IF NOT EXISTS public.blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'account' | 'keyword' | 'url'
    value TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.raw_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

-- Simple Policies (Adjust as needed)
CREATE POLICY "Public Read Events" ON public.events FOR SELECT USING (status = 'PUBLISHED');
CREATE POLICY "Admin All raw_posts" ON public.raw_posts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin All events" ON public.events FOR ALL USING (auth.role() = 'service_role');
