-- ============================================
-- IMPORT SAMPLE MENU (For Feb 2026)
-- ============================================

-- 1. Create a Voting Session for next week (Feb 2026)
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

-- 2. Insert Menu Items (Veg, Non-Veg, Special)

-- Clear old items for this specific session to avoid duplicates/confusion if re-run
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
