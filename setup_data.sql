-- ============================================
-- AUTO-CREATE PROFILE TRIGGER
-- ============================================
-- This trigger automatically creates a profile when a user signs up

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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================

-- Note: You'll need to create test users via Supabase Auth first, then update their profiles
-- For now, this creates sample sessions and menu items

-- Sample Voting Session
INSERT INTO public.voting_sessions (id, title, start_date, end_date, status, created_at)
VALUES 
  (
    '11111111-1111-1111-1111-111111111111',
    'February Week 1 - 2025',
    '2025-02-03',
    '2025-02-09',
    'open_for_voting',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Sample Menu Items for VEG Mess
INSERT INTO public.menu_items (session_id, date_served, meal_type, mess_type, name, description)
VALUES 
  -- Monday Veg
  ('11111111-1111-1111-1111-111111111111', '2025-02-03', 'breakfast', 'veg', 'Idli Sambar', 'Steamed rice cakes with lentil soup'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-03', 'breakfast', 'veg', 'Poha', 'Flattened rice with vegetables'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-03', 'lunch', 'veg', 'Dal Tadka with Rice', 'Yellow lentils with aromatic spices'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-03', 'lunch', 'veg', 'Paneer Butter Masala', 'Cottage cheese in creamy tomato gravy'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-03', 'snacks', 'veg', 'Samosa', 'Crispy pastry with potato filling'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-03', 'dinner', 'veg', 'Chole Bhature', 'Chickpea curry with fried bread'),
  
  -- Tuesday Veg
  ('11111111-1111-1111-1111-111111111111', '2025-02-04', 'breakfast', 'veg', 'Masala Dosa', 'Crispy rice crepe with potato filling'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-04', 'lunch', 'veg', 'Rajma Rice', 'Kidney bean curry with rice'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-04', 'snacks', 'veg', 'Bread Pakora', 'Fried bread fritters'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-04', 'dinner', 'veg', 'Mixed Veg Curry', 'Assorted vegetables in curry')
ON CONFLICT DO NOTHING;

-- Sample Menu Items for NON-VEG Mess
INSERT INTO public.menu_items (session_id, date_served, meal_type, mess_type, name, description)
VALUES 
  -- Monday Non-Veg
  ('11111111-1111-1111-1111-111111111111', '2025-02-03', 'breakfast', 'non_veg', 'Egg Omelette', 'Fluffy eggs with vegetables'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-03', 'lunch', 'non_veg', 'Chicken Biryani', 'Aromatic rice with spiced chicken'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-03', 'lunch', 'non_veg', 'Fish Curry', 'Fresh fish in tangy gravy'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-03', 'dinner', 'non_veg', 'Butter Chicken', 'Chicken in creamy tomato sauce'),
  
  -- Tuesday Non-Veg
  ('11111111-1111-1111-1111-111111111111', '2025-02-04', 'breakfast', 'non_veg', 'Egg Bhurji', 'Scrambled eggs with spices'),
  ('11111111-1111-1111-1111-111111111111', '2025-02-04', 'lunch', 'non_veg', 'Mutton Rogan Josh', 'Tender mutton in aromatic gravy')
ON CONFLICT DO NOTHING;
