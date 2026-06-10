-- Allow any color value (hex, named, etc.) on notes
-- Previously restricted to 5 named colors
alter table notes drop constraint if exists notes_color_check;
alter table notes alter column color set default '#fef9c3';
