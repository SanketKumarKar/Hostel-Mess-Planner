-- Add is_selected column to menu_items to track the Final Menu winners
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT FALSE;

-- Allow Admins to update this column
CREATE POLICY "Admins can update menu selection" 
ON public.menu_items 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'caterer')
  )
);
