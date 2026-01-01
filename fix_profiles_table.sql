-- Fix profiles table: rename residence to region and add missing columns
-- Step 1: Rename residence to region
ALTER TABLE public.profiles RENAME COLUMN residence TO region;

-- Step 2: Ensure interests column exists and is TEXT[]
-- (already exists, just making sure it's the right type)

-- Step 3: Add email notification columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS new_event_notifications BOOLEAN DEFAULT true;

-- Step 4: Add created_at if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Add comments
COMMENT ON COLUMN public.profiles.phone IS '사용자 전화번호';
COMMENT ON COLUMN public.profiles.region IS '거주 지역 (창원, 김해, 진주, 통영, 거제, 양산, 밀양, 함안, 기타)';
COMMENT ON COLUMN public.profiles.interests IS '관심 분야 (전시, 공연, 축제, 전통문화, 체험/교육)';
COMMENT ON COLUMN public.profiles.email_notifications IS '이메일 알림 수신 여부';
COMMENT ON COLUMN public.profiles.new_event_notifications IS '새 이벤트 알림 수신 여부';

-- Show updated table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;
