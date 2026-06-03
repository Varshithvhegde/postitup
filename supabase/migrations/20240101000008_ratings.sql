-- Add ratings toggle to boards
alter table boards add column if not exists enable_ratings boolean not null default false;

-- Ratings table
create table if not exists ratings (
  id uuid default gen_random_uuid() primary key,
  board_id uuid references boards(id) on delete cascade not null,
  stars integer not null check (stars between 1 and 5),
  review text,
  author_name text not null default 'Anonymous',
  user_id uuid references profiles(id) on delete set null,
  voter_fingerprint text not null,
  created_at timestamptz default now(),
  -- one rating per fingerprint per board
  unique (board_id, voter_fingerprint)
);

alter table ratings add constraint ratings_review_length
  check (review is null or char_length(review) <= 300);
alter table ratings add constraint ratings_author_length
  check (char_length(author_name) <= 60);

alter table ratings enable row level security;

-- Anyone can read ratings on public/link boards
create policy "Ratings readable on public boards" on ratings
  for select using (
    exists (
      select 1 from boards
      where boards.id = ratings.board_id
      and boards.visibility in ('public', 'link')
    )
  );

-- Owner can read ratings on private boards
create policy "Owner can read ratings on private boards" on ratings
  for select using (
    exists (
      select 1 from boards
      where boards.id = ratings.board_id
      and boards.owner_id = auth.uid()
    )
  );

-- Anyone can submit a rating on public/link boards that have ratings enabled
create policy "Anyone can submit rating" on ratings
  for insert with check (
    exists (
      select 1 from boards
      where boards.id = ratings.board_id
      and boards.visibility in ('public', 'link')
      and boards.enable_ratings = true
    )
  );

-- Authors and board owners can delete ratings
create policy "Authors and owners can delete ratings" on ratings
  for delete using (
    auth.uid() = user_id or
    exists (
      select 1 from boards
      where boards.id = ratings.board_id
      and boards.owner_id = auth.uid()
    )
  );

-- Enable realtime
alter publication supabase_realtime add table ratings;
alter table ratings replica identity full;
