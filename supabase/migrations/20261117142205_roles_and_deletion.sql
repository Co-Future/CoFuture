-- Organization roles owner / member / guest, and deleting empty organizations and teams.
--   owner:  manages people, roles, access links; deletes the organization once it is empty
--   member: works in teams, creates teams and rounds
--   guest:  only sees the teams they were added to; answers rounds, starts none, creates no teams
-- Roles change what someone may do. Results inside a team look the same for everyone.

alter type public.org_role rename value 'admin' to 'owner';
alter type public.org_role add value if not exists 'guest';

-- Note: functions below compare role::text, because a value added in this transaction
-- cannot be used as an enum literal before the transaction commits.

-- "Admin" is now the owner. The name stays so existing policies keep working.
create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = (select auth.uid()) and role::text = 'owner'
  );
$$;

-- Guests do not see the whole organization, only people they share a team with.
create or replace function public.shares_org_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id and mine.role::text <> 'guest'
  );
$$;

-- True if the caller is a guest in the organization the team belongs to.
create function public.is_guest_for_team(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.teams t
    join public.organization_members om on om.organization_id = t.organization_id
    where t.id = p_team_id and om.user_id = (select auth.uid()) and om.role::text = 'guest'
  );
$$;
revoke execute on function public.is_guest_for_team(uuid) from public, anon;
grant execute on function public.is_guest_for_team(uuid) to authenticated;

create or replace function public.create_organization(p_name text)
returns public.organizations
language plpgsql security definer set search_path = ''
as $$
declare
  new_org public.organizations;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.organizations (name, created_by) values (p_name, (select auth.uid()))
  returning * into new_org;
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org.id, (select auth.uid()), 'owner');
  return new_org;
end;
$$;

-- Guests cannot create teams.
create or replace function public.create_team(p_name text, p_organization_id uuid default null)
returns public.teams
language plpgsql security definer set search_path = ''
as $$
declare
  new_team public.teams;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_organization_id is not null and not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = (select auth.uid()) and role::text <> 'guest'
  ) then
    raise exception 'only owners and members can create teams' using errcode = '42501';
  end if;
  insert into public.teams (name, created_by, organization_id)
  values (p_name, (select auth.uid()), p_organization_id)
  returning * into new_team;
  return new_team;
end;
$$;

-- Guests answer rounds but do not start them.
drop policy "rounds_insert" on public.rounds;
create policy "rounds_insert" on public.rounds for insert to authenticated
  with check (
    public.is_team_member(team_id) and not public.is_guest_for_team(team_id)
    and created_by = (select auth.uid()) and deadline > now()
  );

-- Owners remove people. The last owner cannot be removed.
create or replace function public.remove_organization_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'only owners can remove people' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'owners cannot remove themselves' using errcode = 'P0001', hint = 'self';
  end if;
  if exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = p_user_id and role::text = 'owner'
  ) and not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and role::text = 'owner' and user_id <> p_user_id
  ) then
    raise exception 'an organization needs at least one owner' using errcode = 'P0001', hint = 'last_owner';
  end if;
  -- A team that loses its only lead gets the owner as lead.
  insert into public.team_members (team_id, user_id, role)
  select t.id, (select auth.uid()), 'lead'
  from public.teams t
  join public.team_members tm on tm.team_id = t.id and tm.user_id = p_user_id and tm.role = 'lead'
  where t.organization_id = p_org_id
    and not exists (
      select 1 from public.team_members other
      where other.team_id = t.id and other.role = 'lead' and other.user_id <> p_user_id
    )
  on conflict (team_id, user_id) do update set role = 'lead';
  delete from public.team_members
  where user_id = p_user_id
    and team_id in (select id from public.teams where organization_id = p_org_id);
  delete from public.invites where organization_id = p_org_id and user_id = p_user_id;
  delete from public.organization_members where organization_id = p_org_id and user_id = p_user_id;
end;
$$;

-- Owners assign roles. There is always at least one owner.
create function public.set_organization_role(p_org_id uuid, p_user_id uuid, p_role public.org_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'only owners can change roles' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_members where organization_id = p_org_id and user_id = p_user_id) then
    raise exception 'not a member of this organization' using errcode = 'P0002';
  end if;
  if p_role::text <> 'owner' and not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and role::text = 'owner' and user_id <> p_user_id
  ) then
    raise exception 'an organization needs at least one owner' using errcode = 'P0001', hint = 'last_owner';
  end if;
  update public.organization_members set role = p_role
  where organization_id = p_org_id and user_id = p_user_id;
  -- Guests do not lead teams: their lead role becomes member where another lead exists.
  if p_role::text = 'guest' then
    update public.team_members tm set role = 'member'
    where tm.user_id = p_user_id and tm.role = 'lead'
      and tm.team_id in (select id from public.teams where organization_id = p_org_id)
      and exists (
        select 1 from public.team_members other
        where other.team_id = tm.team_id and other.role = 'lead' and other.user_id <> p_user_id
      );
  end if;
end;
$$;
revoke execute on function public.set_organization_role(uuid, uuid, public.org_role) from public, anon;
grant execute on function public.set_organization_role(uuid, uuid, public.org_role) to authenticated;

-- Owners delete an organization once nobody else is in it. Its teams, rounds and answers go with it.
create function public.delete_organization(p_org_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'only owners can delete the organization' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id <> (select auth.uid())
  ) then
    raise exception 'remove all other people first' using errcode = 'P0001', hint = 'not_empty';
  end if;
  delete from public.organizations where id = p_org_id;
end;
$$;
revoke execute on function public.delete_organization(uuid) from public, anon;
grant execute on function public.delete_organization(uuid) to authenticated;

-- Team leads (or owners of the team's organization) delete a team once nobody else is in it.
create function public.delete_team(p_team_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  team_org uuid;
begin
  select organization_id into team_org from public.teams where id = p_team_id;
  if not found then
    raise exception 'team not found' using errcode = 'P0002';
  end if;
  if not (public.is_team_lead(p_team_id) or (team_org is not null and public.is_org_admin(team_org))) then
    raise exception 'only leads or owners can delete a team' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id <> (select auth.uid())
  ) then
    raise exception 'remove all other people first' using errcode = 'P0001', hint = 'not_empty';
  end if;
  delete from public.teams where id = p_team_id;
end;
$$;
revoke execute on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Accounts the organization created itself (through "Person hinzufügen").
-- Owners may reset their password or delete the account, as long as the person
-- is in no other organization. Self-registered accounts can only be removed.
-- ---------------------------------------------------------------------------
alter table public.organization_members add column managed boolean not null default false;

-- People list: owners see everyone with email and which accounts the organization manages,
-- members see everyone, guests only the people they share a team with.
drop function public.organization_people(uuid);
create function public.organization_people(p_org_id uuid)
returns table (
  user_id uuid, display_name text, role public.org_role, email text, pending boolean,
  managed boolean, joined_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  caller_role text;
begin
  select om.role::text into caller_role from public.organization_members om
  where om.organization_id = p_org_id and om.user_id = (select auth.uid());
  if caller_role is null then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  return query
  select
    om.user_id,
    p.display_name,
    om.role,
    case when caller_role = 'owner' then u.email::text end,
    (
      u.last_sign_in_at is null
      and exists (select 1 from public.invites i where i.user_id = om.user_id and i.used_at is null)
    ),
    (caller_role = 'owner' and om.managed and not exists (
      select 1 from public.organization_members other
      where other.user_id = om.user_id and other.organization_id <> p_org_id
    )),
    om.joined_at
  from public.organization_members om
  join public.profiles p on p.id = om.user_id
  join auth.users u on u.id = om.user_id
  where om.organization_id = p_org_id
    and (caller_role <> 'guest' or om.user_id = (select auth.uid()) or public.shares_team_with(om.user_id))
  order by om.role, p.display_name;
end;
$$;
revoke execute on function public.organization_people(uuid) from public, anon;
grant execute on function public.organization_people(uuid) to authenticated;

-- Hand the organization over: the other person becomes owner, the caller becomes member.
create function public.transfer_organization(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'only owners can hand over the organization' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'choose someone else' using errcode = 'P0001', hint = 'self';
  end if;
  if not exists (select 1 from public.organization_members where organization_id = p_org_id and user_id = p_user_id) then
    raise exception 'not a member of this organization' using errcode = 'P0002';
  end if;
  update public.organization_members set role = 'owner'
  where organization_id = p_org_id and user_id = p_user_id;
  update public.organization_members set role = 'member'
  where organization_id = p_org_id and user_id = (select auth.uid());
end;
$$;
revoke execute on function public.transfer_organization(uuid, uuid) from public, anon;
grant execute on function public.transfer_organization(uuid, uuid) to authenticated;

-- Hand a team over: the other person becomes lead, the caller (if in the team) becomes member.
-- In an organization, the new lead must belong to it and must not be a guest.
create function public.transfer_team(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  team_org uuid;
begin
  select organization_id into team_org from public.teams where id = p_team_id;
  if not found then
    raise exception 'team not found' using errcode = 'P0002';
  end if;
  if not (public.is_team_lead(p_team_id) or (team_org is not null and public.is_org_admin(team_org))) then
    raise exception 'only leads or owners can hand over a team' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'choose someone else' using errcode = 'P0001', hint = 'self';
  end if;
  if team_org is not null and not exists (
    select 1 from public.organization_members
    where organization_id = team_org and user_id = p_user_id and role::text <> 'guest'
  ) then
    raise exception 'new lead must be an owner or member of the organization' using errcode = 'P0001', hint = 'not_eligible';
  end if;
  insert into public.team_members (team_id, user_id, role) values (p_team_id, p_user_id, 'lead')
  on conflict (team_id, user_id) do update set role = 'lead';
  update public.team_members set role = 'member'
  where team_id = p_team_id and user_id = (select auth.uid());
end;
$$;
revoke execute on function public.transfer_team(uuid, uuid) from public, anon;
grant execute on function public.transfer_team(uuid, uuid) to authenticated;
