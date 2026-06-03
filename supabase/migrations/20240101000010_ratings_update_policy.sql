-- Allow position (x, y) updates on ratings for public/link boards
create policy "Anyone can update rating position on public boards" on ratings
  for update using (
    exists (
      select 1 from boards
      where boards.id = ratings.board_id
      and boards.visibility in ('public', 'link')
    )
  );

-- Board owners can update any rating on their boards
create policy "Board owners can update ratings" on ratings
  for update using (
    exists (
      select 1 from boards
      where boards.id = ratings.board_id
      and boards.owner_id = auth.uid()
    )
  );
