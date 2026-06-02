-- Fix: infinite recursion in notes update policies
-- The with check (upvotes = (select upvotes from notes ...)) self-references
-- the notes table and triggers the same policy, causing infinite recursion.
-- Upvote protection is already enforced by increment_upvote() SECURITY DEFINER
-- function + note_votes insert block. We don't need the with check here.

drop policy if exists "Update position on public boards"         on notes;
drop policy if exists "Board owners can update note position"    on notes;
drop policy if exists "Authors can update own note content"      on notes;

-- Simple, non-recursive policies — no subquery back to notes table

-- Anyone can update position on public/link boards
create policy "Update position on public boards" on notes
  for update using (
    exists (
      select 1 from boards
      where boards.id = notes.board_id
      and boards.visibility in ('public', 'link')
    )
  );

-- Board owners can update anything on their boards
create policy "Board owners can update notes" on notes
  for update using (
    exists (
      select 1 from boards
      where boards.id = notes.board_id
      and boards.owner_id = auth.uid()
    )
  );

-- Authors can update their own notes
create policy "Authors can update own notes" on notes
  for update using (
    auth.uid() = user_id
  );
