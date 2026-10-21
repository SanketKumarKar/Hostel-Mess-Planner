-- ============================================================================
-- FEASTFULL NEW FEATURES
-- Run once AFTER combined_setup.sql
-- Safe to run repeatedly. Does not delete existing application data.
-- ============================================================================

-- 1. New role and profile fields
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'parent'
          AND enumtypid = 'public.app_role'::regtype
    ) THEN
        ALTER TYPE public.app_role ADD VALUE 'parent';
    END IF;
END $$;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS hostel_block TEXT,
    ADD COLUMN IF NOT EXISTS room_number TEXT,
    ADD COLUMN IF NOT EXISTS parent_email TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_hostel_block'
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT chk_hostel_block
            CHECK (hostel_block IS NULL OR hostel_block IN ('A', 'B', 'C', 'D', 'E'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_parent_email
    ON public.profiles(parent_email);
CREATE INDEX IF NOT EXISTS idx_profiles_parent_email_lower
    ON public.profiles(lower(parent_email));

-- 2. Nutrition and approval fields used by the menu workflows
ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS kcal INTEGER,
    ADD COLUMN IF NOT EXISTS protein_grams NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';

-- 3. Night mess
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

-- Upgrade a V2 table that used item_name instead of name.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'night_mess_items' AND column_name = 'item_name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'night_mess_items' AND column_name = 'name'
    ) THEN
        ALTER TABLE public.night_mess_items RENAME COLUMN item_name TO name;
    END IF;
END $$;

ALTER TABLE public.night_mess_items
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_night_mess_hostel_block
    ON public.night_mess_items(hostel_block);
CREATE INDEX IF NOT EXISTS idx_night_mess_is_available
    ON public.night_mess_items(is_available);

-- 4. Attendance. Includes both old and new columns so the current app and
-- existing V2 rows remain compatible during the transition.
CREATE TABLE IF NOT EXISTS public.meal_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    meal_date DATE,
    meal_type public.meal_type_enum NOT NULL,
    mess_type public.mess_type_enum,
    logged_at TIMESTAMPTZ,
    duration_mins INTEGER,
    method TEXT,
    date DATE,
    source TEXT DEFAULT 'self_check_in',
    check_in_time TIMESTAMPTZ,
    expected_exit_time TIMESTAMPTZ
);

ALTER TABLE public.meal_attendance
    ADD COLUMN IF NOT EXISTS meal_date DATE,
    ADD COLUMN IF NOT EXISTS mess_type public.mess_type_enum,
    ADD COLUMN IF NOT EXISTS logged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS duration_mins INTEGER,
    ADD COLUMN IF NOT EXISTS method TEXT,
    ADD COLUMN IF NOT EXISTS date DATE,
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'self_check_in',
    ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expected_exit_time TIMESTAMPTZ;

UPDATE public.meal_attendance
SET date = COALESCE(date, meal_date),
    check_in_time = COALESCE(check_in_time, logged_at),
    expected_exit_time = COALESCE(expected_exit_time, logged_at + INTERVAL '22 minutes'),
    source = COALESCE(source, CASE WHEN method = 'face_scan' THEN 'biometric_face_scan' ELSE 'self_check_in' END)
WHERE date IS NULL
   OR check_in_time IS NULL
   OR expected_exit_time IS NULL
   OR source IS NULL;

ALTER TABLE public.meal_attendance
    ALTER COLUMN date SET DEFAULT CURRENT_DATE,
    ALTER COLUMN source SET DEFAULT 'self_check_in',
    ALTER COLUMN check_in_time SET DEFAULT timezone('utc', now()),
    ALTER COLUMN expected_exit_time SET DEFAULT timezone('utc', now()) + INTERVAL '22 minutes';

CREATE INDEX IF NOT EXISTS idx_meal_attendance_student ON public.meal_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_meal_attendance_date ON public.meal_attendance(date);
CREATE INDEX IF NOT EXISTS idx_meal_attendance_meal_type ON public.meal_attendance(meal_type);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'meal_attendance_student_date_meal_type_key'
          AND conrelid = 'public.meal_attendance'::regclass
    ) THEN
        ALTER TABLE public.meal_attendance
            ADD CONSTRAINT meal_attendance_student_date_meal_type_key
            UNIQUE (student_id, date, meal_type);
    END IF;
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'Attendance duplicate rows exist; uniqueness constraint was not added.';
END $$;

-- 5. Occupancy and room delivery
CREATE TABLE IF NOT EXISTS public.mess_occupancy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mess_type public.mess_type_enum NOT NULL,
    meal_type public.meal_type_enum NOT NULL,
    meal_date DATE NOT NULL,
    active_count INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    UNIQUE(mess_type, meal_type, meal_date)
);

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

-- 6. RLS helper functions
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

-- 7. Profile policies, including the policy missing from the old V3 migration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Caterers can view assigned students" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view linked children" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view child profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND (
            role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
            OR public.has_profile_role(ARRAY['admin']::public.app_role[])
        )
    );
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));
CREATE POLICY "Caterers can view assigned students" ON public.profiles
    FOR SELECT USING (assigned_caterer_id = auth.uid() AND role = 'student');
CREATE POLICY "Caterers are viewable by everyone" ON public.profiles
    FOR SELECT USING (role = 'caterer');
CREATE POLICY "Parents can view linked children" ON public.profiles
    FOR SELECT USING (
        public.has_profile_role(ARRAY['parent']::public.app_role[])
        AND role = 'student'
        AND lower(parent_email) = lower(auth.jwt() ->> 'email')
    );

-- 8. Feature policies
ALTER TABLE public.meal_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view own attendance" ON public.meal_attendance;
DROP POLICY IF EXISTS "Students can insert own attendance" ON public.meal_attendance;
DROP POLICY IF EXISTS "Students can log own attendance" ON public.meal_attendance;
DROP POLICY IF EXISTS "Students can delete own attendance" ON public.meal_attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.meal_attendance;
DROP POLICY IF EXISTS "Parents can view child attendance" ON public.meal_attendance;
CREATE POLICY "Students can view own attendance" ON public.meal_attendance FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can insert own attendance" ON public.meal_attendance FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can delete own attendance" ON public.meal_attendance FOR DELETE USING (auth.uid() = student_id);
CREATE POLICY "Admins can view all attendance" ON public.meal_attendance FOR SELECT USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));
CREATE POLICY "Parents can view child attendance" ON public.meal_attendance FOR SELECT USING (public.is_parent_of_student(student_id));

ALTER TABLE public.night_mess_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Night mess viewable by all" ON public.night_mess_items;
DROP POLICY IF EXISTS "Only admins and caterers manage night mess" ON public.night_mess_items;
CREATE POLICY "Night mess viewable by all" ON public.night_mess_items FOR SELECT USING (true);
CREATE POLICY "Only admins and caterers manage night mess" ON public.night_mess_items FOR ALL
    USING (public.has_profile_role(ARRAY['admin', 'caterer']::public.app_role[]))
    WITH CHECK (public.has_profile_role(ARRAY['admin', 'caterer']::public.app_role[]));

ALTER TABLE public.mess_occupancy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read occupancy" ON public.mess_occupancy;
CREATE POLICY "Everyone can read occupancy" ON public.mess_occupancy FOR SELECT USING (true);

ALTER TABLE public.room_delivery_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can insert own requests" ON public.room_delivery_requests;
DROP POLICY IF EXISTS "Students can view own requests" ON public.room_delivery_requests;
DROP POLICY IF EXISTS "Students can delete own requests" ON public.room_delivery_requests;
DROP POLICY IF EXISTS "Admins view all delivery requests" ON public.room_delivery_requests;
DROP POLICY IF EXISTS "Admins manage delivery requests" ON public.room_delivery_requests;
DROP POLICY IF EXISTS "Caterers view assigned requests" ON public.room_delivery_requests;
DROP POLICY IF EXISTS "Caterers update assigned requests" ON public.room_delivery_requests;
CREATE POLICY "Students can insert own requests" ON public.room_delivery_requests FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can view own requests" ON public.room_delivery_requests FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can delete own requests" ON public.room_delivery_requests FOR DELETE USING (auth.uid() = student_id);
CREATE POLICY "Admins view all delivery requests" ON public.room_delivery_requests FOR SELECT USING (public.has_profile_role(ARRAY['admin']::public.app_role[]));
CREATE POLICY "Admins manage delivery requests" ON public.room_delivery_requests FOR ALL
    USING (public.has_profile_role(ARRAY['admin']::public.app_role[]))
    WITH CHECK (public.has_profile_role(ARRAY['admin']::public.app_role[]));
CREATE POLICY "Caterers view assigned requests" ON public.room_delivery_requests FOR SELECT USING (
    public.has_profile_role(ARRAY['caterer']::public.app_role[])
    AND EXISTS (
        SELECT 1 FROM public.profiles student
        WHERE student.id = room_delivery_requests.student_id
          AND student.assigned_caterer_id = auth.uid()
    )
);
CREATE POLICY "Caterers update assigned requests" ON public.room_delivery_requests FOR UPDATE
    USING (
        public.has_profile_role(ARRAY['caterer']::public.app_role[])
        AND EXISTS (
            SELECT 1 FROM public.profiles student
            WHERE student.id = room_delivery_requests.student_id
              AND student.assigned_caterer_id = auth.uid()
        )
    )
    WITH CHECK (public.has_profile_role(ARRAY['caterer']::public.app_role[]));

-- 9. Updated timestamps
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
CREATE TRIGGER trg_night_mess_updated_at BEFORE UPDATE ON public.night_mess_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_room_delivery_updated_at ON public.room_delivery_requests;
CREATE TRIGGER trg_room_delivery_updated_at BEFORE UPDATE ON public.room_delivery_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. Feature settings and active visitor view
INSERT INTO public.system_settings (setting_key, setting_value) VALUES
    ('night_mess_enabled', 'true'),
    ('room_delivery_enabled', 'true'),
    ('biometric_attendance_enabled', 'false')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE VIEW public.active_mess_visitors AS
SELECT mess_type, meal_type, meal_date, COUNT(*) AS visitor_count, MAX(logged_at) AS last_entry
FROM public.meal_attendance
WHERE meal_date = CURRENT_DATE
  AND logged_at > NOW() - INTERVAL '22 minutes'
GROUP BY mess_type, meal_type, meal_date;

-- Complete. Sign out and sign in again after running this script.
