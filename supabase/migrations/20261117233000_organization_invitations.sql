-- Invitations with confirmation (ADR 011, follow-up).
-- An owner who adds an email that already has an account no longer adds the person directly.
-- Instead an invitation is created. The person sees it after signing in and accepts or declines.
-- Only on accepting do they become a member, with the invited role and teams.
--
-- Not to be confused with public.invites: those are one-time access links for accounts the
-- organization created itself (set your password). Invitations never touch passwords.

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  -- Teams of the organization the person joins on accepting. Teams deleted in the meantime are skipped.
  team_ids uuid[] not null default '{}',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- At most one open invitation per person and organization.
  unique (organization_id, user_id)
);
create index organization_invitations_user_id_idx on public.organization_invitations (user_id);

-- ---------------------------------------------------------------------------
-- No overlaps
-- ---------------------------------------------------------------------------

-- Whoever becomes a member (by accepting or any other way) has no open invitation left.
create function public.drop_invitation_on_join()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.organization_invitations
  where organization_id = new.organization_id and user_id = new.user_id;
  return new;
end;
$$;
create trigger drop_invitation_on_join
  after insert on public.organization_members
  for each row execute function public.drop_invitation_on_join();

-- Teams inside an organization only take members of that organization, on every path
-- (functions, the team_members_insert_lead policy, the server with the secret key).
create function public.team_member_in_org()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  team_org uuid;
begin
  select organization_id into team_org from public.teams where id = new.team_id;
  if team_org is not null and not exists (
    select 1 from public.organization_members where organization_id = team_org and user_id = new.user_id
  ) then
    raise exception 'only members of the organization can join its teams' using errcode = 'P0001', hint = 'not_in_org';
  end if;
  return new;
end;
$$;
create trigger team_member_in_org
  before insert or update of user_id, team_id on public.team_members
  for each row execute function public.team_member_in_org();

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Owners invite an existing account by email. Returns
-- 'invited', 'not_found' (no account), 'already_member', 'already_invited' or 'invalid_team'.
create function public.invite_to_organization(
  p_org_id uuid, p_email text, p_role public.org_role default 'member', p_team_ids uuid[] default '{}'
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  target_id uuid;
  teams uuid[] := array(select distinct unnest(coalesce(p_team_ids, '{}')));
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'only owners can invite people' using errcode = '42501';
  end if;

  select id into target_id from auth.users where lower(email) = lower(trim(p_email));
  if target_id is null then
    return 'not_found';
  end if;
  if exists (select 1 from public.organization_members where organization_id = p_org_id and user_id = target_id) then
    return 'already_member';
  end if;
  if exists (
    select 1 from unnest(teams) as t(id)
    where not exists (select 1 from public.teams where id = t.id and organization_id = p_org_id)
  ) then
    return 'invalid_team';
  end if;

  insert into public.organization_invitations (organization_id, user_id, role, team_ids, invited_by)
  values (p_org_id, target_id, p_role, teams, (select auth.uid()))
  on conflict (organization_id, user_id) do nothing;

  return case when found then 'invited' else 'already_invited' end;
end;
$$;
revoke execute on function public.invite_to_organization(uuid, text, public.org_role, uuid[]) from public, anon;
grant execute on function public.invite_to_organization(uuid, text, public.org_role, uuid[]) to authenticated;

-- The invited person accepts: membership with the invited role, plus the invited teams that
-- still exist. Returns the organization id.
create function public.accept_organization_invitation(p_invitation_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.organization_invitations;
begin
  select * into inv from public.organization_invitations
  where id = p_invitation_id and user_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  insert into public.organization_members (organization_id, user_id, role, managed)
  values (inv.organization_id, inv.user_id, inv.role, false)
  on conflict (organization_id, user_id) do nothing;

  insert into public.team_members (team_id, user_id, role)
  select t.id, inv.user_id, 'member'
  from public.teams t
  where t.id = any (inv.team_ids) and t.organization_id = inv.organization_id
  on conflict (team_id, user_id) do nothing;

  delete from public.organization_invitations where id = inv.id;
  return inv.organization_id;
end;
$$;
revoke execute on function public.accept_organization_invitation(uuid) from public, anon;
grant execute on function public.accept_organization_invitation(uuid) to authenticated;

-- The invited person declines, or an owner of the organization withdraws the invitation.
create function public.delete_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.organization_invitations;
begin
  select * into inv from public.organization_invitations where id = p_invitation_id;
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if inv.user_id <> (select auth.uid()) and not public.is_org_admin(inv.organization_id) then
    -- Do not reveal that the invitation exists.
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  delete from public.organization_invitations where id = inv.id;
end;
$$;
revoke execute on function public.delete_organization_invitation(uuid) from public, anon;
grant execute on function public.delete_organization_invitation(uuid) to authenticated;

-- Open invitations of the signed-in person. The person is not a member yet and cannot read the
-- organization or its teams through RLS, so this function returns the names they need.
create function public.my_organization_invitations()
returns table (
  id uuid, organization_id uuid, organization_name text, role public.org_role,
  team_names text[], invited_by_name text, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    i.id,
    i.organization_id,
    o.name,
    i.role,
    array(
      select t.name from public.teams t
      where t.id = any (i.team_ids) and t.organization_id = i.organization_id
      order by t.name
    ),
    p.display_name,
    i.created_at
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  left join public.profiles p on p.id = i.invited_by
  where i.user_id = (select auth.uid())
  order by i.created_at desc;
$$;
revoke execute on function public.my_organization_invitations() from public, anon;
grant execute on function public.my_organization_invitations() to authenticated;

-- Open invitations of an organization, for its owners (with email, like organization_people).
create function public.organization_invitations_list(p_org_id uuid)
returns table (
  id uuid, user_id uuid, display_name text, email text, role public.org_role,
  team_names text[], created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'only owners see open invitations' using errcode = '42501';
  end if;
  return query
  select
    i.id,
    i.user_id,
    p.display_name,
    u.email::text,
    i.role,
    array(
      select t.name from public.teams t
      where t.id = any (i.team_ids) and t.organization_id = i.organization_id
      order by t.name
    ),
    i.created_at
  from public.organization_invitations i
  join public.profiles p on p.id = i.user_id
  join auth.users u on u.id = i.user_id
  where i.organization_id = p_org_id
  order by i.created_at desc;
end;
$$;
revoke execute on function public.organization_invitations_list(uuid) from public, anon;
grant execute on function public.organization_invitations_list(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------
revoke all on public.organization_invitations from anon;
revoke insert, update, delete, truncate, references, trigger on public.organization_invitations from authenticated;

alter table public.organization_invitations enable row level security;

-- The invited person and the owners of the organization see an invitation. Writes only via functions.
create policy "organization_invitations_select" on public.organization_invitations for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_admin(organization_id));
