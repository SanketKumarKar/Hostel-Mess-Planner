-- Fix for Zero Votes in PDF Report
-- The Backend Server uses the 'Anon' key, so it was being blocked from reading votes.
-- This script enables global read access to the 'votes' table so the server can count them.

BEGIN;

-- 1. Remove old restrictive policies that might conflict
DROP POLICY IF EXISTS "Admins can view all votes" ON votes;
DROP POLICY IF EXISTS "Users can view own votes" ON votes;
DROP POLICY IF EXISTS "Enable read access for all users" ON votes;

-- 2. Create a single permissive policy for READING votes
-- This allows Admins, Students, and the Backend Server to see vote data (needed for counts)
CREATE POLICY "Enable public read access on votes" 
ON votes 
FOR SELECT 
USING (true);

-- 3. Ensure Insert/Delete policies remain for security (re-apply if needed or assume they exist)
-- (We only touched SELECT, so existing INSERT/DELETE policies should remain untouched)

COMMIT;
