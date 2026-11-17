-- Access via organizations (ADR 011): an admin creates an organization, adds people and
-- hands each of them a one-time access link. The link lets the person set their own password.
-- Organizations are deliberately thin: name, members, teams. No tenant settings, no billing.
-- Admins only manage people; they see no extra results (same view for everyone).

create type public.org_role as enum ('admin', 'member');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- MVP: one organization per person (unique user_id).
create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- One-time access links. Only the SHA-256 hash of the token is stored.
-- No client access at all: read and written by route handlers with the secret key.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '72 hours',
  used_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index invites_user_id_idx on public.invites (user_id);

-- Teams created inside an organization belong to it. Older teams stay without one.
alter table public.teams add column organization_id uuid references public.organizations (id) on delete cascade;
create index teams_organization_id_idx on public.teams (organization_id);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create function public.my_organization_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select organization_id from public.organization_members where user_id = (select auth.uid());
$$;

create function public.is_org_member(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = (select auth.uid())
  );
$$;

create function public.is_org_admin(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.shares_org_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

revoke execute on function public.my_organization_id(), public.is_org_member(uuid),
  public.is_org_admin(uuid), public.shares_org_with(uuid) from public, anon;
grant execute on function public.my_organization_id(), public.is_org_member(uuid),
  public.is_org_admin(uuid), public.shares_org_with(uuid) to authenticated;

-- Create an organization; the caller becomes its admin. Fails if they already have one.
create function public.create_organization(p_name text)
returns public.organizations
language plpgsql security definer set search_path = ''
as $$
declare
  new_org public.organizations;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.organization_members where user_id = (select auth.uid())) then
    raise exception 'already in an organization' using errcode = 'P0001', hint = 'already_in_org';
  end if;
  insert into public.organizations (name, created_by) values (p_name, (select auth.uid()))
  returning * into new_org;
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org.id, (select auth.uid()), 'admin');
  return new_org;
end;
$$;
revoke execute on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- People list for the organization page. Every member sees names, roles and whether
-- someone has not used their access link yet. Email addresses only for admins.
create function public.organization_people(p_org_id uuid)
returns table (user_id uuid, display_name text, role public.org_role, email text, pending boolean, joined_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  admin boolean := public.is_org_admin(p_org_id);
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  return query
  select
    om.user_id,
    p.display_name,
    om.role,
    case when admin then u.email::text end,
    (
      u.last_sign_in_at is null
      and exists (select 1 from public.invites i where i.user_id = om.user_id and i.used_at is null)
    ),
    om.joined_at
  from public.organization_members om
  join public.profiles p on p.id = om.user_id
  join auth.users u on u.id = om.user_id
  where om.organization_id = p_org_id
  order by om.role, p.display_name;
end;
$$;
revoke execute on function public.organization_people(uuid) from public, anon;
grant execute on function public.organization_people(uuid) to authenticated;

-- Admins remove a person: membership in the organization and in all of its teams.
-- The last admin cannot be removed.
create function public.remove_organization_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'only organization admins can remove people' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'admins cannot remove themselves' using errcode = 'P0001', hint = 'self';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and role = 'admin' and user_id <> p_user_id
  ) and exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and role = 'admin' and user_id = p_user_id
  ) then
    raise exception 'an organization needs at least one admin' using errcode = 'P0001', hint = 'last_admin';
  end if;
  -- Skip the one-lead rule here: a team that loses its only lead gets the admin as lead.
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
revoke execute on function public.remove_organization_member(uuid, uuid) from public, anon;
grant execute on function public.remove_organization_member(uuid, uuid) to authenticated;

-- Teams now belong to the creator's organization, if they have one.
create or replace function public.create_team(p_name text)
returns public.teams
language plpgsql security definer set search_path = ''
as $$
declare
  new_team public.teams;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.teams (name, created_by, organization_id)
  values (p_name, (select auth.uid()), public.my_organization_id())
  returning * into new_team;
  return new_team;
end;
$$;

-- Teams inside an organization only take people from that organization.
create or replace function public.add_team_member_by_email(p_team_id uuid, p_email text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  target_id uuid;
  team_org uuid;
begin
  if not public.is_team_lead(p_team_id) then
    raise exception 'only team leads can add members' using errcode = '42501';
  end if;

  select id into target_id from auth.users where lower(email) = lower(trim(p_email));
  if target_id is null then
    return 'not_found';
  end if;

  select organization_id into team_org from public.teams where id = p_team_id;
  if team_org is not null and not exists (
    select 1 from public.organization_members where organization_id = team_org and user_id = target_id
  ) then
    return 'not_found';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (p_team_id, target_id, 'member')
  on conflict (team_id, user_id) do nothing;

  return case when found then 'added' else 'already_member' end;
end;
$$;

-- Add someone from the same organization by id (used by the picker on the team page).
create function public.add_team_member(p_team_id uuid, p_user_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  team_org uuid;
begin
  if not public.is_team_lead(p_team_id) then
    raise exception 'only team leads can add members' using errcode = '42501';
  end if;
  select organization_id into team_org from public.teams where id = p_team_id;
  if team_org is null or not exists (
    select 1 from public.organization_members where organization_id = team_org and user_id = p_user_id
  ) then
    return 'not_found';
  end if;
  insert into public.team_members (team_id, user_id, role)
  values (p_team_id, p_user_id, 'member')
  on conflict (team_id, user_id) do nothing;
  return case when found then 'added' else 'already_member' end;
end;
$$;
revoke execute on function public.add_team_member(uuid, uuid) from public, anon;
grant execute on function public.add_team_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------
revoke all on public.organizations, public.organization_members, public.invites from anon;
revoke all on public.invites from authenticated;
revoke insert, update, delete on public.organizations, public.organization_members from authenticated;
grant update (name) on public.organizations to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invites enable row level security; -- no policies: clients get nothing

create policy "organizations_select" on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy "organizations_update_admin" on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

create policy "organization_members_select" on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id));

-- People in the same organization see each other's display name (needed for team pickers).
create policy "profiles_select_org" on public.profiles for select to authenticated
  using (public.shares_org_with(id));
