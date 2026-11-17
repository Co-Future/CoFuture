-- Team management: leads add registered people by email; a team always keeps a lead.

-- Adds a registered person to a team by email. Only leads may call it.
-- Returns 'added', 'already_member' or 'not_found'. Email addresses never leave the database.
create function public.add_team_member_by_email(p_team_id uuid, p_email text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  target_id uuid;
begin
  if not public.is_team_lead(p_team_id) then
    raise exception 'only team leads can add members' using errcode = '42501';
  end if;

  select id into target_id from auth.users where lower(email) = lower(trim(p_email));
  if target_id is null then
    return 'not_found';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (p_team_id, target_id, 'member')
  on conflict (team_id, user_id) do nothing;

  return case when found then 'added' else 'already_member' end;
end;
$$;
revoke execute on function public.add_team_member_by_email(uuid, text) from public, anon;
grant execute on function public.add_team_member_by_email(uuid, text) to authenticated;

-- Blocks removing or demoting the last lead of a team (deleting the whole team is still allowed).
create function public.keep_one_lead()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.role <> 'lead' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'lead' then
    return new;
  end if;
  if not exists (select 1 from public.teams where id = old.team_id) then
    return coalesce(new, old); -- team is being deleted (cascade)
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = old.team_id and role = 'lead' and user_id <> old.user_id
  ) then
    raise exception 'a team needs at least one lead' using errcode = 'P0001', hint = 'last_lead';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger keep_one_lead
  before update of role or delete on public.team_members
  for each row execute function public.keep_one_lead();
