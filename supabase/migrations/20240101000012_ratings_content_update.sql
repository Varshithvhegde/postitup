-- Allow authors to update their own rating review text and stars
create policy "Authors can update own rating" on ratings
  for update using (auth.uid() = user_id);
