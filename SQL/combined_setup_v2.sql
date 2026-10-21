-- ==============================================================================
-- FEASTFULL — UNIFIED DATABASE SETUP SCRIPT (VERSION 2.0)
-- ==============================================================================
-- Complete, self-contained Disaster Recovery & Fresh Setup Schema.
-- Includes all core modules:
--   1. Extensions & Custom Types / Enums
--   2. Profiles & Role Management (Student, Caterer, Admin, Parent)
--   3. Voting Sessions & Multi-Week Cycle Planning
--   4. Menu Items with Nutrition Tracking (kcal, protein) & Status Approvals
--   5. Student Voting Logistics
--   6. Daily Food & General Feedback with AI Review Flags
--   7. Targeted Caterer Announcements
--   8. Night Mess Ordering & Block Availability
--   9. Real-time Meal Attendance & Dining Crowd Estimation
--  10. Care Delivery / Special Medical Room Delivery Requests
--  11. Campus Events Calendar
--  12. Row-Level Security (RLS) Policies & Helper Functions
--  13. Automated Profile & Registration Verification Triggers
--  14. System Configuration & Initial Seed Data
-- ==============================================================================

-- 1. SETUP & EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM DEFINITIONS
-- ==============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('student', 'caterer', 'admin', 'parent');
    ELSE
        -- Ensure 'parent' exists if app_role was created in an earlier version
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'parent'
              AND enumtypid = 'public.app_role'::regtype
        ) THEN
            ALTER TYPE public.app_role ADD VALUE 'parent';
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mess_type_enum') THEN
        CREATE TYPE public.mess_type_enum AS ENUM ('veg', 'non_veg', 'special', 'food_park');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_type_enum') THEN
        CREATE TYPE public.meal_type_enum AS ENUM ('breakfast', 'lunch', 'snacks', 'dinner');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
        CREATE TYPE public.session_status AS ENUM ('draft', 'open_for_voting', 'closed', 'finalized');
    END IF;
END $$;

-- 3. CORE TABLES
-- ==============================================================================

-- PROFILES (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name TEXT,
  role public.app_role DEFAULT 'student',
  mess_type public.mess_type_enum,
  reg_number TEXT,
  hostel_block TEXT CHECK (hostel_block IS NULL OR hostel_block IN ('A', 'B', 'C', 'D', 'E')),
  room_number TEXT,
  parent_email TEXT,
  served_mess_types TEXT[],
  assigned_caterer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles column backwards compatibility
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hostel_block TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS room_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS served_mess_types TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_caterer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_parent_email ON public.profiles(parent_email);
CREATE INDEX IF NOT EXISTS idx_profiles_parent_email_lower ON public.profiles(lower(parent_email));
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_caterer ON public.profiles(assigned_caterer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- VOTING SESSIONS
CREATE TABLE IF NOT EXISTS public.voting_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  title TEXT,
  session_weeks INTEGER NOT NULL DEFAULT 2 CHECK (session_weeks IN (1, 2)),
  breakfast_limit INTEGER NOT NULL DEFAULT 4 CHECK (breakfast_limit > 0),
  lunch_limit INTEGER NOT NULL DEFAULT 8 CHECK (lunch_limit > 0),
  snacks_limit INTEGER NOT NULL DEFAULT 2 CHECK (snacks_limit > 0),
  dinner_limit INTEGER NOT NULL DEFAULT 8 CHECK (dinner_limit > 0),
  status public.session_status DEFAULT 'draft',
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_dates CHECK (end_date >= start_date)
);

ALTER TABLE public.voting_sessions ADD COLUMN IF NOT EXISTS session_weeks INTEGER NOT NULL DEFAULT 2;
ALTER TABLE public.voting_sessions ADD COLUMN IF NOT EXISTS breakfast_limit INTEGER NOT NULL DEFAULT 4;
ALTER TABLE public.voting_sessions ADD COLUMN IF NOT EXISTS lunch_limit INTEGER NOT NULL DEFAULT 8;
ALTER TABLE public.voting_sessions ADD COLUMN IF NOT EXISTS snacks_limit INTEGER NOT NULL DEFAULT 2;
ALTER TABLE public.voting_sessions ADD COLUMN IF NOT EXISTS dinner_limit INTEGER NOT NULL DEFAULT 8;

CREATE INDEX IF NOT EXISTS idx_voting_sessions_status ON public.voting_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voting_sessions_dates ON public.voting_sessions(start_date, end_date);

-- MENU ITEMS
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.voting_sessions(id) ON DELETE CASCADE NOT NULL,
  date_served DATE NOT NULL,
  meal_type public.meal_type_enum NOT NULL,
  mess_type public.mess_type_enum NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_selected BOOLEAN DEFAULT FALSE,
  kcal INTEGER,
  protein_grams NUMERIC(6, 2),
  approval_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS kcal INTEGER;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS protein_grams NUMERIC(6, 2);
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_menu_items_session ON public.menu_items(session_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_date_meal ON public.menu_items(date_served, meal_type, mess_type);

-- VOTES
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_user ON public.votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_item ON public.votes(menu_item_id);

-- EVENTS
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  location TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);

-- FEEDBACKS
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  caterer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  response TEXT,
  meal_type TEXT,
  feedback_date DATE,
  day_label TEXT,
  image_url TEXT,
  feedback_type TEXT DEFAULT 'general',
  reviewed_by_ai BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS meal_type TEXT;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS feedback_date DATE;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS day_label TEXT;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS feedback_type TEXT DEFAULT 'general';
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS reviewed_by_ai BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_feedbacks_student ON public.feedbacks(student_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_caterer ON public.feedbacks(caterer_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_daily ON public.feedbacks(caterer_id, feedback_type, feedback_date, meal_type);

-- ANNOUNCEMENTS (Caterer broadcasts to student dining halls)
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  caterer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  mess_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_caterer ON public.announcements(caterer_id);
CREATE INDEX IF NOT EXISTS idx_announcements_mess_type ON public.announcements(mess_type);

-- NIGHT MESS ITEMS (Hostel late-night menu ordering)
CREATE TABLE IF NOT EXISTS public.night_mess_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_block TEXT NOT NULL CHECK (hostel_block IN ('A', 'B', 'C', 'D', 'E')),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  price NUMERIC(8, 2) NOT NULL CHECK (price >= 0),
  is_available BOOLEAN DEFAULT TRUE,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_night_mess_hostel_block ON public.night_mess_items(hostel_block);
CREATE INDEX IF NOT EXISTS idx_night_mess_is_available ON public.night_mess_items(is_available);

-- MEAL ATTENDANCE (Live student dining check-in & occupancy)
CREATE TABLE IF NOT EXISTS public.meal_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  meal_date DATE,
  meal_type public.meal_type_enum NOT NULL,
  mess_type public.mess_type_enum,
  source TEXT DEFAULT 'self_check_in',
  check_in_time TIMESTAMPTZ DEFAULT timezone('utc', now()),
  expected_exit_time TIMESTAMPTZ DEFAULT timezone('utc', now()) + INTERVAL '22 minutes',
  logged_at TIMESTAMPTZ,
  duration_mins INTEGER,
  method TEXT,
  UNIQUE(student_id, date, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_meal_attendance_student ON public.meal_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_meal_attendance_date ON public.meal_attendance(date);
CREATE INDEX IF NOT EXISTS idx_meal_attendance_meal_type ON public.meal_attendance(meal_type);

-- MESS OCCUPANCY (Aggregated active diner counts per slot)
CREATE TABLE IF NOT EXISTS public.mess_occupancy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mess_type public.mess_type_enum NOT NULL,
  meal_type public.meal_type_enum NOT NULL,
  meal_date DATE NOT NULL,
  active_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(mess_type, meal_type, meal_date)
);

-- SPECIAL REQUESTS / CARE DELIVERY (Medical room deliveries for sick/injured students)
CREATE TABLE IF NOT EXISTS public.room_delivery_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snacks', 'dinner')),
  hostel_block TEXT NOT NULL CHECK (hostel_block IN ('A', 'B', 'C', 'D', 'E')),
  room_number TEXT NOT NULL,
  reason TEXT NOT NULL,
  proof_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'packed', 'out_for_delivery', 'delivered')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_delivery_student ON public.room_delivery_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_room_delivery_date ON public.room_delivery_requests(date);
CREATE INDEX IF NOT EXISTS idx_room_delivery_status ON public.room_delivery_requests(status);

-- SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL
);

-- 4. HELPER FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Security role check helper
CREATE OR REPLACE FUNCTION public.has_profile_role(required_roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = ANY(required_roles)
  );
$$;

-- Parent-student relation check helper
CREATE OR REPLACE FUNCTION public.is_parent_of_student(student_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles child
    JOIN public.profiles parent ON parent.id = auth.uid() AND parent.role = 'parent'
    WHERE child.id = student_uuid
      AND child.role = 'student'
      AND lower(child.parent_email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_night_mess_updated_at ON public.night_mess_items;
CREATE TRIGGER trg_night_mess_updated_at
  BEFORE UPDATE ON public.night_mess_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_room_delivery_updated_at ON public.room_delivery_requests;
CREATE TRIGGER trg_room_delivery_updated_at
  BEFORE UPDATE ON public.room_delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create Profile on Signup
-- (Explicitly runs with search_path = public to avoid Auth schema lookup errors)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    mess_type,
    reg_number,
    hostel_block,
    room_number,
    parent_email,
    assigned_caterer_id
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'::public.app_role),
    COALESCE((NEW.raw_user_meta_data->>'mess_type')::public.mess_type_enum, 'veg'::public.mess_type_enum),
    NEW.raw_user_meta_data->>'reg_number',
    NEW.raw_user_meta_data->>'hostel_block',
    NEW.raw_user_meta_data->>'room_number',
    NEW.raw_user_meta_data->>'parent_email',
    NULLIF(NEW.raw_user_meta_data->>'assigned_caterer_id', '')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    mess_type = COALESCE(EXCLUDED.mess_type, public.profiles.mess_type);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger Function: Enforce Closed Registration Settings
CREATE OR REPLACE FUNCTION public.check_registration_open()
RETURNS TRIGGER AS $$
DECLARE
  is_caterer_allowed TEXT;
  is_admin_allowed TEXT;
BEGIN
  -- Check Caterer registration toggle
  IF NEW.role = 'caterer' THEN
    SELECT setting_value INTO is_caterer_allowed FROM public.system_settings WHERE setting_key = 'caterer_registration';
    IF is_caterer_allowed = 'false' THEN
      RAISE EXCEPTION 'Caterer registration is currently closed.';
    END IF;
  END IF;

  -- Check Admin registration toggle
  IF NEW.role = 'admin' THEN
    SELECT setting_value INTO is_admin_allowed FROM public.system_settings WHERE setting_key = 'admin_registration';
    IF is_admin_allowed = 'false' THEN
      RAISE EXCEPTION 'Admin registration is currently closed.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS check_registration_trigger ON public.profiles;
CREATE TRIGGER check_registration_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_registration_open();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      OR public.has_profile_role(ARRAY['admin']::public.app_role[])
    )
  );

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));

DROP POLICY IF EXISTS "Caterers can view assigned students" ON public.profiles;
CREATE POLICY "Caterers can view assigned students" ON public.profiles
  FOR SELECT USING (assigned_caterer_id = auth.uid() AND role = 'student');

DROP POLICY IF EXISTS "Caterers are viewable by everyone" ON public.profiles;
CREATE POLICY "Caterers are viewable by everyone" ON public.profiles
  FOR SELECT USING (role = 'caterer');

DROP POLICY IF EXISTS "Parents can view linked children" ON public.profiles;
CREATE POLICY "Parents can view linked children" ON public.profiles
  FOR SELECT USING (
    public.has_profile_role(ARRAY['parent']::public.app_role[])
    AND role = 'student'
    AND lower(parent_email) = lower(auth.jwt() ->> 'email')
  );

-- VOTING SESSIONS
ALTER TABLE public.voting_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sessions viewable by everyone" ON public.voting_sessions;
CREATE POLICY "Sessions viewable by everyone" ON public.voting_sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage sessions" ON public.voting_sessions;
CREATE POLICY "Admins can manage sessions" ON public.voting_sessions
  FOR ALL USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));

-- MENU ITEMS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Menu items viewable by everyone" ON public.menu_items;
CREATE POLICY "Menu items viewable by everyone" ON public.menu_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Caterers and Admins can manage menu items" ON public.menu_items;
CREATE POLICY "Caterers and Admins can manage menu items" ON public.menu_items
  FOR ALL USING (public.has_profile_role(ARRAY['admin', 'caterer']::public.app_role[]));

DROP POLICY IF EXISTS "Admins can update menu selection" ON public.menu_items;
CREATE POLICY "Admins can update menu selection" ON public.menu_items
  FOR UPDATE USING (public.has_profile_role(ARRAY['admin', 'caterer']::public.app_role[]));

-- VOTES
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable public read access on votes" ON public.votes;
CREATE POLICY "Enable public read access on votes" ON public.votes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can vote" ON public.votes;
CREATE POLICY "Users can vote" ON public.votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update/delete own votes" ON public.votes;
CREATE POLICY "Users can update/delete own votes" ON public.votes
  FOR ALL USING (auth.uid() = user_id);

-- EVENTS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
CREATE POLICY "Events are viewable by everyone" ON public.events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Admins can manage events" ON public.events
  FOR ALL USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));

-- FEEDBACKS
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can insert own feedback" ON public.feedbacks;
CREATE POLICY "Students can insert own feedback" ON public.feedbacks
  FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can view own feedback" ON public.feedbacks;
CREATE POLICY "Students can view own feedback" ON public.feedbacks
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Caterers can view feedback for them" ON public.feedbacks;
CREATE POLICY "Caterers can view feedback for them" ON public.feedbacks
  FOR SELECT USING (auth.uid() = caterer_id);

DROP POLICY IF EXISTS "Caterers can respond to feedback" ON public.feedbacks;
CREATE POLICY "Caterers can respond to feedback" ON public.feedbacks
  FOR UPDATE USING (auth.uid() = caterer_id);

DROP POLICY IF EXISTS "Admins can view all feedbacks" ON public.feedbacks;
CREATE POLICY "Admins can view all feedbacks" ON public.feedbacks
  FOR SELECT USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));

DROP POLICY IF EXISTS "Admins can manage feedbacks" ON public.feedbacks;
CREATE POLICY "Admins can manage feedbacks" ON public.feedbacks
  FOR ALL USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));

-- ANNOUNCEMENTS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Announcements viewable by everyone" ON public.announcements;
CREATE POLICY "Announcements viewable by everyone" ON public.announcements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Caterers and Admins can insert announcements" ON public.announcements;
CREATE POLICY "Caterers and Admins can insert announcements" ON public.announcements
  FOR INSERT WITH CHECK (
    auth.uid() = caterer_id OR public.has_profile_role(ARRAY['admin']::public.app_role[])
  );

DROP POLICY IF EXISTS "Caterers and Admins can delete announcements" ON public.announcements;
CREATE POLICY "Caterers and Admins can delete announcements" ON public.announcements
  FOR DELETE USING (
    auth.uid() = caterer_id OR public.has_profile_role(ARRAY['admin']::public.app_role[])
  );

-- NIGHT MESS ITEMS
ALTER TABLE public.night_mess_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Night mess viewable by all" ON public.night_mess_items;
CREATE POLICY "Night mess viewable by all" ON public.night_mess_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins and caterers manage night mess" ON public.night_mess_items;
CREATE POLICY "Only admins and caterers manage night mess" ON public.night_mess_items
  FOR ALL
  USING (public.has_profile_role(ARRAY['admin', 'caterer']::public.app_role[]))
  WITH CHECK (public.has_profile_role(ARRAY['admin', 'caterer']::public.app_role[]));

-- MEAL ATTENDANCE
ALTER TABLE public.meal_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own attendance" ON public.meal_attendance;
CREATE POLICY "Students can view own attendance" ON public.meal_attendance
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert own attendance" ON public.meal_attendance;
CREATE POLICY "Students can insert own attendance" ON public.meal_attendance
  FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can delete own attendance" ON public.meal_attendance;
CREATE POLICY "Students can delete own attendance" ON public.meal_attendance
  FOR DELETE USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can view all attendance" ON public.meal_attendance;
CREATE POLICY "Admins can view all attendance" ON public.meal_attendance
  FOR SELECT USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));

DROP POLICY IF EXISTS "Parents can view child attendance" ON public.meal_attendance;
CREATE POLICY "Parents can view child attendance" ON public.meal_attendance
  FOR SELECT USING (public.is_parent_of_student(student_id));

-- MESS OCCUPANCY
ALTER TABLE public.mess_occupancy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read occupancy" ON public.mess_occupancy;
CREATE POLICY "Everyone can read occupancy" ON public.mess_occupancy
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update occupancy" ON public.mess_occupancy;
CREATE POLICY "Admins can update occupancy" ON public.mess_occupancy
  FOR ALL USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));

-- ROOM DELIVERY REQUESTS
ALTER TABLE public.room_delivery_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can insert own requests" ON public.room_delivery_requests;
CREATE POLICY "Students can insert own requests" ON public.room_delivery_requests
  FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can view own requests" ON public.room_delivery_requests;
CREATE POLICY "Students can view own requests" ON public.room_delivery_requests
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can delete own requests" ON public.room_delivery_requests;
CREATE POLICY "Students can delete own requests" ON public.room_delivery_requests
  FOR DELETE USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins view all delivery requests" ON public.room_delivery_requests;
CREATE POLICY "Admins view all delivery requests" ON public.room_delivery_requests
  FOR SELECT USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));

DROP POLICY IF EXISTS "Admins manage delivery requests" ON public.room_delivery_requests;
CREATE POLICY "Admins manage delivery requests" ON public.room_delivery_requests
  FOR ALL
  USING (public.has_profile_role(ARRAY['admin']::public.app_role[]))
  WITH CHECK (public.has_profile_role(ARRAY['admin']::public.app_role[]));

DROP POLICY IF EXISTS "Caterers view assigned requests" ON public.room_delivery_requests;
CREATE POLICY "Caterers view assigned requests" ON public.room_delivery_requests
  FOR SELECT USING (
    public.has_profile_role(ARRAY['caterer']::public.app_role[])
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      WHERE student.id = room_delivery_requests.student_id
        AND student.assigned_caterer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Caterers update assigned requests" ON public.room_delivery_requests;
CREATE POLICY "Caterers update assigned requests" ON public.room_delivery_requests
  FOR UPDATE
  USING (
    public.has_profile_role(ARRAY['caterer']::public.app_role[])
    AND EXISTS (
      SELECT 1 FROM public.profiles student
      WHERE student.id = room_delivery_requests.student_id
        AND student.assigned_caterer_id = auth.uid()
    )
  )
  WITH CHECK (public.has_profile_role(ARRAY['caterer']::public.app_role[]));

-- SYSTEM SETTINGS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view system settings" ON public.system_settings;
CREATE POLICY "Everyone can view system settings" ON public.system_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
CREATE POLICY "Admins can update system settings" ON public.system_settings
  FOR UPDATE USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));

-- 6. VIEWS
-- ==============================================================================

CREATE OR REPLACE VIEW public.active_mess_visitors AS
SELECT mess_type, meal_type, date AS meal_date, COUNT(*) AS visitor_count, MAX(check_in_time) AS last_entry
FROM public.meal_attendance
WHERE date = CURRENT_DATE
  AND check_in_time > NOW() - INTERVAL '22 minutes'
GROUP BY mess_type, meal_type, date;

-- 7. INITIAL CONFIGURATION & SEED DATA
-- ==============================================================================

INSERT INTO public.system_settings (setting_key, setting_value)
VALUES 
  ('caterer_registration', 'true'),
  ('admin_registration', 'false'),
  ('night_mess_enabled', 'true'),
  ('room_delivery_enabled', 'true'),
  ('biometric_attendance_enabled', 'false')
ON CONFLICT (setting_key) DO NOTHING;

-- ==============================================================================
-- SETUP COMPLETE
-- All tables, enums, indexes, functions, triggers, and RLS policies are installed.
-- ==============================================================================
