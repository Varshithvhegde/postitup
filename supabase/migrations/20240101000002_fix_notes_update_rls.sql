-- Drop the overly restrictive update policy
drop policy if exists "Authors can update own notes" on notes;

-- Allow anyone to update position (x, y) on public/link boards
-- Board owners can update anything on their boards
-- Authors can update their own notes content
create policy "Position updates allowed on public boards" on notes
  for update using (
    exists (
      select 1 from boards
      where boards.id = notes.board_id
      and boards.visibility in ('public', 'link')
    )
  );

create policy "Board owners can update any note" on notes
  for update using (
    exists (
      select 1 from boards
      where boards.id = notes.board_id
      and boards.owner_id = auth.uid()
    )
  );
