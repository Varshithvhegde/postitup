-- Board-level toggle: automatically use light text on dark notes (default on)
alter table boards add column if not exists auto_contrast boolean not null default true;
