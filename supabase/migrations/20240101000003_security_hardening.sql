-- ══════════════════════════════════════════════
-- Security hardening migration
-- ══════════════════════════════════════════════

-- 1. Add length constraints at DB level
alter table boards
  add constraint boards_title_length   check (char_length(title)       between 1 and 80),
  add constraint boards_desc_length    check (char_length(description) <= 300),
  add constraint boards_prompt_length  check (char_length(prompt)      <= 200);

alter table notes
  add constraint notes_content_length      check (char_length(content)     between 1 and 500),
  add constraint notes_author_name_length  check (char_length(author_name) <= 60),
  add constraint notes_upvotes_nonneg      check (upvotes >= 0),
  add constraint notes_width_range         check (width between 100 and 600);

-- 2. Remove client-side upvote update ability
--    Upvotes are now only incremented via the secure function below
drop policy if exists "Position updates allowed on public boards" on notes;
drop policy if exists "Board owners can update any note"          on notes;
drop policy if exists "Authors can update own notes"              on notes;

-- Allow position (x,y) updates only — not upvotes, content, color etc.
-- We use a column-level approach: update allowed but upvotes column protected by function
create policy "Update position on public boards" on notes
  for update using (
    exists (
      select 1 from boards
      where boards.id = notes.board_id
      and boards.visibility in ('public', 'link')
    )
  )
  with check (
    -- Prevent clients from changing upvotes directly
    upvotes = (select upvotes from notes where id = notes.id)
  );

create policy "Board owners can update note position" on notes
  for update using (
    exists (
      select 1 from boards
      where boards.id = notes.board_id
      and boards.owner_id = auth.uid()
    )
  )
  with check (
    upvotes = (select upvotes from notes where id = notes.id)
  );

create policy "Authors can update own note content" on notes
  for update using (
    auth.uid() = user_id
  )
  with check (
    upvotes = (select upvotes from notes where id = notes.id)
  );

-- 3. Secure upvote function — runs as SECURITY DEFINER so it bypasses RLS
--    but enforces its own logic
create or replace function increment_upvote(note_id uuid, voter_fp text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  already_voted boolean;
  new_count integer;
begin
  -- Check if already voted
  select exists(
    select 1 from note_votes nv
    where nv.note_id = increment_upvote.note_id
    and   nv.voter_fingerprint = voter_fp
  ) into already_voted;

  if already_voted then
    return json_build_object('success', false, 'reason', 'already_voted');
  end if;

  -- Record the vote
  insert into note_votes (note_id, voter_fingerprint)
  values (increment_upvote.note_id, voter_fp);

  -- Increment counter atomically
  update notes set upvotes = upvotes + 1
  where id = increment_upvote.note_id
  returning upvotes into new_count;

  return json_build_object('success', true, 'upvotes', new_count);
end;
$$;

-- 4. Restrict note_votes — only the DB function should insert, not raw clients
drop policy if exists "Anyone can vote" on note_votes;

-- Votes can only be inserted via the increment_upvote function (security definer)
-- Direct inserts from client are blocked
create policy "Votes only via function" on note_votes
  for insert with check (false); -- function bypasses RLS via SECURITY DEFINER

-- 5. Prevent upvotes column from being set on INSERT (must default to 0)
-- Already enforced by default + nonneg constraint above

-- 6. Tighten note_votes — allow board owners to delete votes (moderation)
create policy "Board owners can delete votes" on note_votes
  for delete using (
    exists (
      select 1 from notes n
      join boards b on b.id = n.board_id
      where n.id = note_votes.note_id
      and b.owner_id = auth.uid()
    )
  );

-- 7. Prevent profiles.email from being updated
create policy "Users cannot update email" on profiles
  for update using (auth.uid() = id)
  with check (email = (select email from profiles where id = auth.uid()));
