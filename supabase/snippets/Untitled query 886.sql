-- Restore Subscribers Data
-- Run this in Supabase SQL Editor

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
-- Allow anyone to insert (for newsletter signup form)
DROP POLICY IF EXISTS "Public Insert Subscribers" ON public.subscribers;
CREATE POLICY "Public Insert Subscribers" ON public.subscribers FOR INSERT WITH CHECK (true);

-- Allow admins/service_role to do everything, or public read for now if auth is not fully set up
-- For simplicity in this demo phase, we might allow public read for the admin page to work easily, 
-- or ensure the admin page user is authenticated. 
-- Assuming the admin page is protected by layout but fetches as 'public' or logged in user.
-- Let's allow authenticated read.
DROP POLICY IF EXISTS "Authenticated Select Subscribers" ON public.subscribers;
CREATE POLICY "Authenticated Select Subscribers" ON public.subscribers FOR SELECT TO authenticated USING (true);

-- Also allow anon read if we are just testing without auth
DROP POLICY IF EXISTS "Anon Select Subscribers" ON public.subscribers;
CREATE POLICY "Anon Select Subscribers" ON public.subscribers FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon Delete Subscribers" ON public.subscribers;
CREATE POLICY "Anon Delete Subscribers" ON public.subscribers FOR DELETE TO anon USING (true);

-- 4. Insert Dummy Data (20 records)
INSERT INTO public.subscribers (email, is_active, subscribed_at)
VALUES 
  ('user_01@example.com', true, NOW() - INTERVAL '1 day'),
  ('user_02@example.com', true, NOW() - INTERVAL '2 days'),
  ('user_03@gn.go.kr', true, NOW() - INTERVAL '3 days'),
  ('art_lover@naver.com', true, NOW() - INTERVAL '4 days'),
  ('design_pro@gmail.com', false, NOW() - INTERVAL '5 days'),
  ('museum_fan@daum.net', true, NOW() - INTERVAL '6 days'),
  ('curator_kim@art.kr', true, NOW() - INTERVAL '7 days'),
  ('student_park@uni.ac.kr', true, NOW() - INTERVAL '8 days'),
  ('press_lee@news.com', true, NOW() - INTERVAL '9 days'),
  ('gallery_owner@shop.com', false, NOW() - INTERVAL '10 days'),
  ('artist_choi@studio.com', true, NOW() - INTERVAL '11 days'),
  ('kritik@review.com', true, NOW() - INTERVAL '12 days'),
  ('event_planner@party.com', true, NOW() - INTERVAL '13 days'),
  ('local_guide@trip.com', true, NOW() - INTERVAL '14 days'),
  ('photo_mj@studio.net', true, NOW() - INTERVAL '15 days'),
  ('music_fan@sound.com', false, NOW() - INTERVAL '16 days'),
  ('dance_crew@move.com', true, NOW() - INTERVAL '17 days'),
  ('theater_goer@act.com', true, NOW() - INTERVAL '18 days'),
  ('sponsor_rich@corp.com', true, NOW() - INTERVAL '19 days'),
  ('admin_test@artnav.kr', true, NOW() - INTERVAL '20 days')
ON CONFLICT (email) DO NOTHING;
