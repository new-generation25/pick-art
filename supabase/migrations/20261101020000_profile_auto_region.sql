-- 설정의 "내 지역 자동 적용". 켜져 있으면 로그인 사용자가 홈에 올 때 거주 지역 필터를 자동으로 건다(기본 켜짐)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_region BOOLEAN NOT NULL DEFAULT true;
