-- Lane mode (Kanban columns) — beta feature
-- Adds lane_id to notes so each note belongs to a column

-- Add lane mode to boards
alter table boards alter column mode type text;
-- mode can now also be 'lane'

-- Add lane column to notes (null = free canvas note)
alter table notes add column if not exists lane_id text default null;

-- Lane order within a lane (for vertical sorting)
alter table notes add column if not exists lane_order integer default 0;

-- RLS: lane_id update follows same rules as position update
-- (already covered by existing update policies)
