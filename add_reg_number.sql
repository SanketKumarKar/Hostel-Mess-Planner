-- Add registration number field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS reg_number text;

-- Add comment
COMMENT ON COLUMN public.profiles.reg_number IS 'Student registration number (only for students)';
