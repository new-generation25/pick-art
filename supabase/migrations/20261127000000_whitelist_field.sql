-- 수집 대상 계정(whitelist)의 분야 구분
--   field : 그 계정이 주로 알리는 행사의 분야 하나. 정하는 기준은 docs/INSTA_ENGAGE.md 「계정 분야 구분」
--     연극 · 뮤지컬 · 음악 · 무용 · 전통 · 전시 · 공예 · 문학 · 영화 · 축제 · 복합
--     복합 = 여러 분야를 고루 알리는 공연장·재단·지자체·공간, 그리고 제보자(informant) 계정
--   비어 있으면(NULL) 아직 판단하지 않은 계정이다
-- 쓰는 쪽: 계정을 넣거나 고칠 때 판단한 사람·AI가 채운다(service 키). 읽기·쓰기 권한은 whitelist 의 기존 RLS 그대로
-- 되돌리기: ALTER TABLE public.whitelist DROP CONSTRAINT IF EXISTS whitelist_field_check; ALTER TABLE public.whitelist DROP COLUMN IF EXISTS field;

ALTER TABLE public.whitelist ADD COLUMN IF NOT EXISTS field text;

ALTER TABLE public.whitelist DROP CONSTRAINT IF EXISTS whitelist_field_check;
ALTER TABLE public.whitelist ADD CONSTRAINT whitelist_field_check
  CHECK (field IS NULL OR field IN ('연극','뮤지컬','음악','무용','전통','전시','공예','문학','영화','축제','복합'));
