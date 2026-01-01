-- Add dummy subscribers for testing
-- Current count: 14, adding 6 more for a total of 20

INSERT INTO public.subscribers (email, is_active, created_at) VALUES
('choi.minho@gmail.com', true, NOW() - INTERVAL '15 days'),
('jung.sora@naver.com', true, NOW() - INTERVAL '12 days'),
('kang.jiwon@daum.net', true, NOW() - INTERVAL '10 days'),
('song.hyejin@kakao.com', true, NOW() - INTERVAL '7 days'),
('yoon.seokjin@gmail.com', true, NOW() - INTERVAL '5 days'),
('han.minjeong@naver.com', false, NOW() - INTERVAL '20 days')
ON CONFLICT (email) DO NOTHING;

-- Verify the new subscribers
SELECT COUNT(*) as total_subscribers,
       COUNT(*) FILTER (WHERE is_active = true) as active_subscribers,
       COUNT(*) FILTER (WHERE is_active = false) as inactive_subscribers
FROM public.subscribers;
