-- events 테이블에 누락된 필수 컬럼 추가
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_address TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_time_start TIME;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_time_end TIME;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

-- raw_posts 테이블도 점검 및 created_at 누락 방지 (이미 있을 가능성 높음)
ALTER TABLE public.raw_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
