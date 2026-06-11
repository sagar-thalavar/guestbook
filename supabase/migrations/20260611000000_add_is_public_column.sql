-- Add is_public column to guestbook_entries table with default of false (ensures existing entries remain private)
ALTER TABLE public.guestbook_entries 
ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Policy to allow anyone (public) to view guestbook entries that are approved and marked public
CREATE POLICY "Allow public to view approved public entries" 
ON public.guestbook_entries 
FOR SELECT 
USING (status = 'approved' AND is_public = true);
