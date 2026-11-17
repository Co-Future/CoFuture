-- Several organizations per person (ADR 011, follow-up): people switch between them in the app.
-- The app keeps the current organization in a cookie; the database only checks membership.

alter table public.organization_members drop constraint organization_members_user_id_key;
create index organization_members_user_id_idx on public.organization_members (user_id);

-- Was "the" organization of a person. With several it is ambiguous, so it goes.
drop function public.my_organization_id();

-- Creating another organization is allowed now.
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
  values (new_org.id, (select auth.uid()), 'admin');
  return new_org;
end;
$$;

-- Teams are created in an explicit organization (the one selected in the app).
-- Without one, the team has no organization (old behaviour).
drop function public.create_team(text);
create function public.create_team(p_name text, p_organization_id uuid default null)
returns public.teams
language plpgsql security definer set search_path = ''
as $$
declare
  new_team public.teams;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_organization_id is not null and not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  insert into public.teams (name, created_by, organization_id)
  values (p_name, (select auth.uid()), p_organization_id)
  returning * into new_team;
  return new_team;
end;
$$;
revoke execute on function public.create_team(text, uuid) from public, anon;
grant execute on function public.create_team(text, uuid) to authenticated;

-- Server-side lookup when an admin adds an email that already has an account
-- (the person then simply joins the organization). Only for the secret key.
create function public.find_user_id_by_email(p_email text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email));
$$;
revoke execute on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;
