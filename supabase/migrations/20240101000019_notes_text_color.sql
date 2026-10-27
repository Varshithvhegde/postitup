-- Optional per-note text color (hex). NULL = automatic contrast against the note color.
alter table notes add column if not exists text_color text
  check (text_color is null or text_color ~ '^#[0-9a-fA-F]{6}$');
