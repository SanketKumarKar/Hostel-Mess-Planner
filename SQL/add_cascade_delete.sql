-- Add ON DELETE CASCADE / SET NULL to existing constraints

-- 1. PROFILES linking to AUTH.USERS
-- First, finding the constraint name is tricky in generic scripts, so we try to drop based on known structure or just use ALTER TABLE assuming standard names or recreating.
-- For safety in this script, we will DROP the constraint if we know it, or try to Replace it.
-- Since Supabase/Postgres names can vary, the most robust way is to drop by foreign key definition.

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey; -- Standard naming convention

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 2. VOTING_SESSIONS linking to PROFILES
ALTER TABLE public.voting_sessions
DROP CONSTRAINT IF EXISTS voting_sessions_created_by_fkey;

ALTER TABLE public.voting_sessions
ADD CONSTRAINT voting_sessions_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 3. VOTES linking to PROFILES (user_id)
ALTER TABLE public.votes
DROP CONSTRAINT IF EXISTS votes_user_id_fkey;

ALTER TABLE public.votes
ADD CONSTRAINT votes_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 4. FEEDBACKS linking to PROFILES (student_id)
ALTER TABLE public.feedbacks
DROP CONSTRAINT IF EXISTS feedbacks_student_id_fkey;

ALTER TABLE public.feedbacks
ADD CONSTRAINT feedbacks_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 5. FEEDBACKS linking to PROFILES (caterer_id)
ALTER TABLE public.feedbacks
DROP CONSTRAINT IF EXISTS feedbacks_caterer_id_fkey;

ALTER TABLE public.feedbacks
ADD CONSTRAINT feedbacks_caterer_id_fkey
FOREIGN KEY (caterer_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 6. PROFILES linking to PROFILES (assigned_caterer_id) - NEW COLUMN from v2
-- We want SET NULL here because if a caterer is deleted, the student account should remain, just unassigned.
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_assigned_caterer_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_assigned_caterer_id_fkey
FOREIGN KEY (assigned_caterer_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 7. MENU ITEMS (Already has cascade on session_id in schema.sql, but good to double check if needed. Skipping for now as it was in original schema.)
