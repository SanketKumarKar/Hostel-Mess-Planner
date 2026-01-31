-- ============================================
-- DATABASE REPAIR SCRIPT
-- ============================================

-- 1. Drop the trigger that is causing the signup error
-- The client app now handles profile creation manually, so this trigger is creating conflicts/errors.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Ensure the reg_number column exists
-- If it already exists, this will just print a notice (safe to run)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'reg_number') THEN
        ALTER TABLE public.profiles ADD COLUMN reg_number text;
    END IF;
END $$;

-- 3. Verify Policies (Just to be safe)
-- Ensure users can insert/update their own profiles
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4. Clean up any "half-created" users if necessary (optional, manual cleanup is safer)
-- (Users without profiles will simply be fixed next time they login if we add checking logic, 
--  but for now they might need to use a new email)
