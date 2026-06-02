-- Run this in your Supabase SQL editor

-- Profiles (auto-created on auth.users insert)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Public profiles are viewable" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Boards
create table if not exists boards (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  title text not null,
  description text,
  owner_id uuid references profiles(id) on delete cascade not null,
  visibility text not null default 'link' check (visibility in ('public','link','private')),
  mode text not null default 'free' check (mode in ('free','grid','ruled')),
  prompt text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table boards enable row level security;
create policy "Public boards viewable by all" on boards for select using (visibility = 'public');
create policy "Link boards viewable by all" on boards for select using (visibility = 'link');
create policy "Private boards viewable by owner" on boards for select using (auth.uid() = owner_id);
create policy "Owners can insert boards" on boards for insert with check (auth.uid() = owner_id);
create policy "Owners can update boards" on boards for update using (auth.uid() = owner_id);
create policy "Owners can delete boards" on boards for delete using (auth.uid() = owner_id);

-- Notes
create table if not exists notes (
  id uuid default gen_random_uuid() primary key,
  board_id uuid references boards(id) on delete cascade not null,
  content text not null,
  color text not null default 'yellow' check (color in ('yellow','blue','pink','green','orange')),
  x float not null default 100,
  y float not null default 100,
  width float not null default 200,
  rotation float not null default 0,
  author_name text not null default 'Anonymous',
  user_id uuid references profiles(id) on delete set null,
  upvotes integer not null default 0,
  created_at timestamptz default now()
);
alter table notes enable row level security;
create policy "Notes on public/link boards viewable by all" on notes for select using (
  exists (select 1 from boards where boards.id = notes.board_id and boards.visibility in ('public','link'))
);
create policy "Notes on private boards viewable by owner" on notes for select using (
  exists (select 1 from boards where boards.id = notes.board_id and boards.owner_id = auth.uid())
);
create policy "Anyone can insert notes on public/link boards" on notes for insert with check (
  exists (select 1 from boards where boards.id = notes.board_id and boards.visibility in ('public','link'))
);
create policy "Authors can update own notes" on notes for update using (auth.uid() = user_id);
create policy "Authors and board owners can delete notes" on notes for delete using (
  auth.uid() = user_id or
  exists (select 1 from boards where boards.id = notes.board_id and boards.owner_id = auth.uid())
);

-- Note votes (prevent double voting)
create table if not exists note_votes (
  note_id uuid references notes(id) on delete cascade,
  voter_fingerprint text not null,
  primary key (note_id, voter_fingerprint)
);
alter table note_votes enable row level security;
create policy "Anyone can vote" on note_votes for insert with check (true);
create policy "Anyone can see votes" on note_votes for select using (true);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Enable realtime on notes
alter publication supabase_realtime add table notes;
