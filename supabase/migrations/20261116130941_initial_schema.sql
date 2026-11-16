-- CoFuture: initial schema for accounts, teams, rounds and responses.
-- Principles enforced here (see CLAUDE.md):
--   * Same view for everyone: roles change what you may DO, never what you may SEE.
--   * Pseudonym by default: other members never see who wrote a response.
--   * Independent answers: other responses become visible only after a round is closed.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.team_role as enum ('lead', 'member');
create type public.round_status as enum ('open', 'closed', 'decided');
create type public.response_source as enum ('text', 'voice');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.team_role not null default 'member',
  show_real_name boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_id_idx on public.team_members (user_id);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  parent_round_id uuid references public.rounds (id) on delete set null,
  question text not null check (char_length(question) between 3 and 500),
  context text check (char_length(context) <= 4000),
  deadline timestamptz not null,
  anonymous boolean not null default true,
  status public.round_status not null default 'open',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index rounds_team_id_idx on public.rounds (team_id);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  pseudonym text not null,
  source public.response_source not null default 'text',
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, author_id),
  unique (round_id, pseudonym)
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer avoids RLS recursion on team_members)
-- ---------------------------------------------------------------------------
create function public.is_team_member(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = (select auth.uid())
  );
$$;

create function public.is_team_lead(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = (select auth.uid()) and role = 'lead'
  );
$$;

create function public.shares_team_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members mine
    join public.team_members theirs on theirs.team_id = mine.team_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

revoke execute on function public.is_team_member(uuid), public.is_team_lead(uuid),
  public.shares_team_with(uuid) from public, anon;
grant execute on function public.is_team_member(uuid), public.is_team_lead(uuid),
  public.shares_team_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Every new auth user gets a profile. Display name from sign-up metadata, else the email prefix.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The creator of a team becomes its first lead.
create function public.handle_new_team()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.team_members (team_id, user_id, role) values (new.id, new.created_by, 'lead');
  return new;
end;
$$;
create trigger on_team_created
  after insert on public.teams
  for each row execute function public.handle_new_team();

-- Create a team and return it in one call. A plain insert + select would fail the
-- select policy, because the membership row is written by the trigger above only
-- after the insert statement has produced its RETURNING row.
create function public.create_team(p_name text)
returns public.teams
language plpgsql security definer set search_path = ''
as $$
declare
  new_team public.teams;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.teams (name, created_by) values (p_name, (select auth.uid()))
  returning * into new_team;
  return new_team;
end;
$$;
revoke execute on function public.create_team(text) from public, anon;
grant execute on function public.create_team(text) to authenticated;

-- Pseudonyms A01, A02 … per round, in order of the first answer.
create function public.assign_pseudonym()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  next_number int;
begin
  perform pg_advisory_xact_lock(hashtext(new.round_id::text));
  select count(*) + 1 into next_number from public.responses where round_id = new.round_id;
  new.pseudonym := 'A' || lpad(next_number::text, 2, '0');
  return new;
end;
$$;
create trigger on_response_insert
  before insert on public.responses
  for each row execute function public.assign_pseudonym();

create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger on_response_update
  before update on public.responses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anonymous visitors; updates only on editable columns
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.teams, public.team_members, public.rounds, public.responses from anon;
revoke update on public.profiles, public.teams, public.team_members, public.rounds, public.responses
  from authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name) on public.teams to authenticated;
grant update (role, show_real_name) on public.team_members to authenticated;
grant update (question, context, deadline, status, closed_at) on public.rounds to authenticated;
grant update (body, source) on public.responses to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.rounds enable row level security;
alter table public.responses enable row level security;

-- profiles: see yourself and people you share a team with; edit only yourself
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_team_with(id));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- teams: members see their teams; anyone signed in may create one; leads rename or delete
create policy "teams_select" on public.teams for select to authenticated
  using (public.is_team_member(id));
create policy "teams_insert" on public.teams for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "teams_update_lead" on public.teams for update to authenticated
  using (public.is_team_lead(id)) with check (public.is_team_lead(id));
create policy "teams_delete_lead" on public.teams for delete to authenticated
  using (public.is_team_lead(id));

-- team_members: members see each other; leads add and change members;
-- everyone may change their own real-name consent or leave
create policy "team_members_select" on public.team_members for select to authenticated
  using (public.is_team_member(team_id));
create policy "team_members_insert_lead" on public.team_members for insert to authenticated
  with check (public.is_team_lead(team_id));
create policy "team_members_update" on public.team_members for update to authenticated
  using (public.is_team_lead(team_id) or user_id = (select auth.uid()))
  with check (public.is_team_lead(team_id) or (user_id = (select auth.uid()) and role = 'member'));
create policy "team_members_delete" on public.team_members for delete to authenticated
  using (public.is_team_lead(team_id) or user_id = (select auth.uid()));

-- rounds: members see and start rounds; creator or lead change them
create policy "rounds_select" on public.rounds for select to authenticated
  using (public.is_team_member(team_id));
create policy "rounds_insert" on public.rounds for insert to authenticated
  with check (
    public.is_team_member(team_id) and created_by = (select auth.uid()) and deadline > now()
  );
create policy "rounds_update" on public.rounds for update to authenticated
  using (created_by = (select auth.uid()) or public.is_team_lead(team_id))
  with check (created_by = (select auth.uid()) or public.is_team_lead(team_id));

-- responses: the base table is private to its author. Others read through round_responses.
create policy "responses_select_own" on public.responses for select to authenticated
  using (author_id = (select auth.uid()));
create policy "responses_insert_open_round" on public.responses for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.rounds r
      where r.id = round_id and r.status = 'open' and r.deadline > now()
        and public.is_team_member(r.team_id)
    )
  );
create policy "responses_update_open_round" on public.responses for update to authenticated
  using (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.rounds r where r.id = round_id and r.status = 'open' and r.deadline > now()
    )
  )
  with check (author_id = (select auth.uid()));
create policy "responses_delete_open_round" on public.responses for delete to authenticated
  using (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.rounds r where r.id = round_id and r.status = 'open' and r.deadline > now()
    )
  );

-- ---------------------------------------------------------------------------
-- View: responses as other members may see them
-- Runs with the owner's rights on purpose (security_invoker = false) so that it can
-- show other people's answers WITHOUT exposing author_id. Access is filtered in WHERE.
-- ---------------------------------------------------------------------------
create view public.round_responses with (security_invoker = false) as
select
  r.id,
  r.round_id,
  r.pseudonym,
  case when not ro.anonymous and tm.show_real_name then p.display_name end as display_name,
  r.source,
  r.body,
  r.created_at,
  r.updated_at,
  (r.author_id = (select auth.uid())) as is_own
from public.responses r
join public.rounds ro on ro.id = r.round_id
left join public.team_members tm on tm.team_id = ro.team_id and tm.user_id = r.author_id
left join public.profiles p on p.id = r.author_id
where public.is_team_member(ro.team_id)
  and (ro.status <> 'open' or r.author_id = (select auth.uid()));

revoke all on public.round_responses from anon, authenticated;
grant select on public.round_responses to authenticated;
