-- Drop the old mode check constraint and add new one that includes 'lane'
alter table boards drop constraint if exists boards_mode_check;
alter table boards add constraint boards_mode_check
  check (mode in ('free', 'grid', 'ruled', 'lane'));
