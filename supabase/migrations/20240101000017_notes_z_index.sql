-- Add z_index column to notes for bring-to-front / send-to-back support
ALTER TABLE notes ADD COLUMN IF NOT EXISTS z_index integer NOT NULL DEFAULT 0;
