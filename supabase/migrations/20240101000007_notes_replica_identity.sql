-- Enable REPLICA IDENTITY FULL on notes so Supabase Realtime DELETE
-- events include the full old row (including id) in payload.old.
-- Without this, payload.old is empty and delete events can't be matched.
alter table notes replica identity full;
