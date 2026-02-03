-- Add 'food_park' to mess_type_enum
ALTER TYPE mess_type_enum ADD VALUE 'food_park';

-- Add served_mess_types to profiles (For Caterers)
-- Stores array of strings like ['veg', 'non_veg', 'food_park']
ALTER TABLE public.profiles ADD COLUMN served_mess_types text[];

-- Add assigned_caterer_id to profiles (For Students)
ALTER TABLE public.profiles ADD COLUMN assigned_caterer_id uuid REFERENCES public.profiles(id);

-- Update RLS policies to allow reading these new columns
-- (Existing "Public profiles are viewable by everyone" should cover select, but let's double check updates)

-- Allow users to update their own new columns
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);
