-- ══════════════════════════════════════════════
-- Account deletion & GDPR data export
-- ══════════════════════════════════════════════

-- 1. Secure account deletion function
--    Deletes all user data then removes the auth.users record
create or replace function delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Notes on the user's boards cascade-delete automatically via FK
  -- But also anonymise notes the user posted on OTHER boards
  -- (don't delete them — they're public contributions — just remove authorship)
  update notes
    set user_id     = null,
        author_name = 'Deleted User'
    where user_id = v_user_id
    and board_id not in (
      select id from boards where owner_id = v_user_id
    );

  -- Delete all boards (notes + votes cascade via FK)
  delete from boards where owner_id = v_user_id;

  -- Delete profile
  delete from profiles where id = v_user_id;

  -- Delete the auth user (must be last)
  delete from auth.users where id = v_user_id;
end;
$$;

-- 2. GDPR data export function — returns everything we hold about the user
create or replace function export_user_data()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile  json;
  v_boards   json;
  v_notes    json;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select row_to_json(p) into v_profile
    from profiles p where p.id = v_user_id;

  select json_agg(b) into v_boards
    from boards b where b.owner_id = v_user_id;

  select json_agg(n) into v_notes
    from notes n where n.user_id = v_user_id;

  return json_build_object(
    'exported_at', now(),
    'profile',     v_profile,
    'boards',      coalesce(v_boards, '[]'::json),
    'notes',       coalesce(v_notes,  '[]'::json)
  );
end;
$$;
