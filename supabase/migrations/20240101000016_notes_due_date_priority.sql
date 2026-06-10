-- Add due date and priority to notes for Kanban use
alter table notes add column if not exists due_date date default null;
alter table notes add column if not exists priority text default null
  check (priority is null or priority in ('high', 'medium', 'low'));
