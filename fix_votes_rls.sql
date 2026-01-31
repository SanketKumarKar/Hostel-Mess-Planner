-- ============================================
-- FIX RLS FOR VOTES (Admin/Caterer Visibility)
-- ============================================

-- Current Issue: "Users can view own votes" prevents Admins from counting total votes.
-- Fix: Add a policy that allows Admins members to SELECT all votes.

-- 1. Enable RLS (just to be safe)
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- 2. Add Policy for Admins
DROP POLICY IF EXISTS "Admins can view all votes" ON public.votes;

CREATE POLICY "Admins can view all votes" 
ON public.votes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'caterer')
  )
);

-- Note: We keep the existing "Users can view own votes" policy so students can still see their own.
-- Supabase combines policies with OR, so:
-- (User is Owner) OR (User is Admin) = Access Granted.
