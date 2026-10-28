-- Add phone, region, and interests fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS interests TEXT[];

-- Add comment
COMMENT ON COLUMN public.profiles.phone IS '사용자 전화번호';
COMMENT ON COLUMN public.profiles.region IS '거주 지역 (창원, 김해, 진주, 통영, 거제, 양산, 밀양, 함안, 기타)';
COMMENT ON COLUMN public.profiles.interests IS '관심 분야 (전시, 공연, 축제, 전통문화, 체험/교육)';
