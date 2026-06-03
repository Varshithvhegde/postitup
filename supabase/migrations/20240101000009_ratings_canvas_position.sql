-- Add canvas position to ratings so they appear as cards on the board
alter table ratings
  add column if not exists x float not null default 120,
  add column if not exists y float not null default 120,
  add column if not exists width float not null default 220,
  add column if not exists rotation float not null default 0;
