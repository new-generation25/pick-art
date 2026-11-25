-- 피카 인스타에 소개한 행사 표시 (docs/plan/insta_inflow_design.md ④)
--   insta_post_url  : 피카 인스타(@picka.news) 게시물 주소. 이미 공개된 인스타 게시물이라 공개 행이면 누구나 읽어도 된다
--   insta_posted_at : 게시일(KST). 「인스타에서 본 행사」 모음의 정렬·기간에 쓴다
-- 채우는 쪽: 정기 수집 끝의 collector/tools/sync_insta_posts.py (docs/insta/posted.json 을 읽기만 한다, service 키)
-- 읽기·쓰기 권한은 events 의 기존 RLS 그대로(익명은 PUBLISHED 행만 읽기, 쓰기는 관리자·service)
-- 되돌리기: ALTER TABLE public.events DROP COLUMN IF EXISTS insta_post_url, DROP COLUMN IF EXISTS insta_posted_at;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS insta_post_url text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS insta_posted_at date;

CREATE INDEX IF NOT EXISTS events_insta_posted_at_idx ON public.events (insta_posted_at) WHERE insta_posted_at IS NOT NULL;
