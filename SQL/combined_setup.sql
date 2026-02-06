-- ==============================================================================
-- UNIFIED DATABASE SETUP SCRIPT
-- ==============================================================================
-- This script combines the entire schema, security settings, and initial data
-- for the Menu Selection Application. It replaces all previous partial SQL files.
-- ==============================================================================

-- 1. SETUP & EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM DEFINITIONS
-- ==============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('student', 'caterer', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mess_type_enum') THEN
        CREATE TYPE mess_type_enum AS ENUM ('veg', 'non_veg', 'special', 'food_park');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_type_enum') THEN
        CREATE TYPE meal_type_enum AS ENUM ('breakfast', 'lunch', 'snacks', 'dinner');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
        CREATE TYPE session_status AS ENUM ('draft', 'open_for_voting', 'closed', 'finalized');
    END IF;
END $$;

-- 3. TABLES
-- ==============================================================================

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name text,
  role app_role DEFAULT 'student',
  mess_type mess_type_enum, -- Default preference (for students)
  reg_number text, -- Registration number (for students)
  served_mess_types text[], -- Array of mess types served (for caterers)
  assigned_caterer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- For students
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
COMMENT ON COLUMN public.profiles.reg_number IS 'Student registration number (only for students)';

-- VOTING SESSIONS
CREATE TABLE IF NOT EXISTS public.voting_sessions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  start_date date NOT NULL,
  end_date date NOT NULL,
  title text,
  status session_status DEFAULT 'draft',
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_dates CHECK (end_date >= start_date)
);

-- MENU ITEMS
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id uuid REFERENCES public.voting_sessions(id) ON DELETE CASCADE NOT NULL,
  date_served date NOT NULL,
  meal_type meal_type_enum NOT NULL,
  mess_type mess_type_enum NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  is_selected boolean DEFAULT FALSE, -- Metadata for finalized menus
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- VOTES
CREATE TABLE IF NOT EXISTS public.votes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, menu_item_id) -- Prevent double voting
);

-- EVENTS
CREATE TABLE IF NOT EXISTS public.events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  description text,
  date timestamp with time zone NOT NULL,
  location text,
  image_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);

-- FEEDBACKS
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  caterer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  response text, -- NULL = Pending, Not NULL = Responded
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key text PRIMARY KEY,
  setting_value text NOT NULL -- 'true' or 'false'
);

-- 4. ROW LEVEL SECURITY (RLS) & POLICIES
-- ==============================================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- VOTING SESSIONS
ALTER TABLE public.voting_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sessions viewable by everyone" ON public.voting_sessions;
CREATE POLICY "Sessions viewable by everyone" ON public.voting_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage sessions" ON public.voting_sessions;
CREATE POLICY "Admins can manage sessions" ON public.voting_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- MENU ITEMS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Menu items viewable by everyone" ON public.menu_items;
CREATE POLICY "Menu items viewable by everyone" ON public.menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Caterers and Admins can manage menu items" ON public.menu_items;
CREATE POLICY "Caterers and Admins can manage menu items" ON public.menu_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'caterer' OR profiles.role = 'admin'))
);

DROP POLICY IF EXISTS "Admins can update menu selection" ON public.menu_items;
CREATE POLICY "Admins can update menu selection" ON public.menu_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'caterer'))
);

-- VOTES
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Consolidated read policy for Votes (fixes count issues for admins/server)
DROP POLICY IF EXISTS "Enable public read access on votes" ON public.votes;
CREATE POLICY "Enable public read access on votes" ON public.votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can vote" ON public.votes;
CREATE POLICY "Users can vote" ON public.votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update/delete own votes" ON public.votes;
CREATE POLICY "Users can update/delete own votes" ON public.votes FOR ALL USING (auth.uid() = user_id);

-- EVENTS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
CREATE POLICY "Events are viewable by everyone" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Admins can manage events" ON public.events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- FEEDBACKS
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can insert own feedback" ON public.feedbacks;
CREATE POLICY "Students can insert own feedback" ON public.feedbacks FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can view own feedback" ON public.feedbacks;
CREATE POLICY "Students can view own feedback" ON public.feedbacks FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Caterers can view feedback for them" ON public.feedbacks;
CREATE POLICY "Caterers can view feedback for them" ON public.feedbacks FOR SELECT USING (auth.uid() = caterer_id);

DROP POLICY IF EXISTS "Caterers can respond to feedback" ON public.feedbacks;
CREATE POLICY "Caterers can respond to feedback" ON public.feedbacks FOR UPDATE USING (auth.uid() = caterer_id);

DROP POLICY IF EXISTS "Admins can view all feedbacks" ON public.feedbacks;
CREATE POLICY "Admins can view all feedbacks" ON public.feedbacks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- SYSTEM SETTINGS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view system settings" ON public.system_settings;
CREATE POLICY "Everyone can view system settings" ON public.system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
CREATE POLICY "Admins can update system settings" ON public.system_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. FUNCTION & TRIGGERS
-- ==============================================================================

-- Trigger Function: Auto-create Profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, mess_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student'::app_role),
    COALESCE((NEW.raw_user_meta_data->>'mess_type')::mess_type_enum, 'veg'::mess_type_enum)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create Profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger Function: Check Registration Open
CREATE OR REPLACE FUNCTION check_registration_open()
RETURNS TRIGGER AS $$
DECLARE
    is_caterer_allowed text;
    is_admin_allowed text;
BEGIN
    -- Check for Caterer
    IF NEW.role = 'caterer' THEN
        SELECT setting_value INTO is_caterer_allowed FROM system_settings WHERE setting_key = 'caterer_registration';
        IF is_caterer_allowed = 'false' THEN
            RAISE EXCEPTION 'Caterer registration is currently closed.';
        END IF;
    END IF;

    -- Check for Admin
    IF NEW.role = 'admin' THEN
        SELECT setting_value INTO is_admin_allowed FROM system_settings WHERE setting_key = 'admin_registration';
        IF is_admin_allowed = 'false' THEN
            RAISE EXCEPTION 'Admin registration is currently closed.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Check Registration
DROP TRIGGER IF EXISTS check_registration_trigger ON public.profiles;
CREATE TRIGGER check_registration_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION check_registration_open();

-- 6. SEED DATA
-- ==============================================================================

-- Default System Settings
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES 
  ('caterer_registration', 'true'),
  ('admin_registration', 'true')
ON CONFLICT (setting_key) DO NOTHING;

-- Sample Session (Feb 2026)
INSERT INTO public.voting_sessions (id, title, start_date, end_date, status, created_at)
VALUES 
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Fixed UUID for easy linking
    'February Week 1 - 2026',
    '2026-02-02', -- Monday
    '2026-02-08', -- Sunday
    'open_for_voting',
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET 
  status = 'open_for_voting',
  title = 'February Week 1 - 2026';

-- Sample Menu Items
-- (Clearing old items for this session first to ensure clean state if re-run)
DELETE FROM public.menu_items WHERE session_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

INSERT INTO public.menu_items (session_id, date_served, meal_type, mess_type, name, description)
VALUES 
  -- MONDAY (2026-02-02) --------------------------------
  -- Veg
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-02', 'breakfast', 'veg', 'Idli Sambar', 'Steamed rice cakes with spicy lentil soup'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-02', 'lunch', 'veg', 'Paneer Butter Masala', 'Rich creamy curry with cottage cheese'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-02', 'dinner', 'veg', 'Veg Biryani', 'Spiced rice with mixed vegetables'),
  -- Non-Veg
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-02', 'lunch', 'non_veg', 'Chicken Curry', 'Spicy home-style chicken curry'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-02', 'dinner', 'non_veg', 'Egg Curry', 'Boiled eggs in tomato gravy'),
  
  -- TUESDAY (2026-02-03) --------------------------------
  -- Veg
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-03', 'breakfast', 'veg', 'Aloo Paratha', 'Stuffed flatbread with curd'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-03', 'lunch', 'veg', 'Rajma Chawal', 'Kidney beans with steamed rice'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-03', 'dinner', 'veg', 'Mix Veg Dry', 'Sautéed seasonal vegetables'),
  -- Non-Veg
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-03', 'lunch', 'non_veg', 'Fish Fry', 'Crispy fried fish with spices'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-03', 'dinner', 'non_veg', 'Chicken Biryani', 'Special Hyderabadi style biryani'),

  -- WEDNESDAY (2026-02-04) --------------------------------
  -- Veg
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-04', 'breakfast', 'veg', 'Poha', 'Flattened rice with peanuts and onions'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-04', 'lunch', 'veg', 'Kadhi Pakora', 'Yogurt based curry with fritters'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-04', 'dinner', 'veg', 'Dal Makhani', 'Creamy black lentils'),
  -- Non-Veg
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-04', 'lunch', 'non_veg', 'Mutton Rogan Josh', 'Kashmiri style mutton curry'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2026-02-04', 'dinner', 'non_veg', 'Chicken 65', 'Spicy deep fried chicken starter');
