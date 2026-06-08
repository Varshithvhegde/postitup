-- Allow authors to update their own note content
-- (position updates already allowed by existing policies)
-- This is a separate policy targeting content edits by the note author
create policy "Authors can update own note content" on notes
  for update using (auth.uid() = user_id);
