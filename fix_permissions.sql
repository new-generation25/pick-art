-- Fix RLS Policies for Supabase Local Development
-- This script relaxes the policies to allow deletion and updates.

BEGIN;

-- 1. Raw Posts: Allow ALL actions for everyone (since it's a local/admin tool)
DROP POLICY IF EXISTS "Admin All raw_posts" ON public.raw_posts;
DROP POLICY IF EXISTS "Allow All" ON public.raw_posts;

CREATE POLICY "Allow All raw_posts" ON public.raw_posts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Events: Allow ALL actions
DROP POLICY IF EXISTS "Admin All events" ON public.events;
DROP POLICY IF EXISTS "Public Read Events" ON public.events;
DROP POLICY IF EXISTS "Allow All" ON public.events;

CREATE POLICY "Allow All events" ON public.events
    FOR ALL
    USING (true)
    WITH CHECK (true);

COMMIT;
