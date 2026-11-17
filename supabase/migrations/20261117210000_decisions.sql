-- Step 7: decisions. A closed round ends with a decision that people make, with a rationale.
-- AsyncMeet only prepares (perspective map); the decision itself is always written by a person.
--   - Follow-up rounds (also used for short follow-up questions) link to their origin round.
--   - One decision per round. Decisions are not edited afterwards, so they stay traceable.
--   - Everyone in the team sees the decision. Read receipts show only a count, never who
--     has not read yet (content, not people).

-- ---------------------------------------------------------------------------
-- Follow-up rounds
-- ---------------------------------------------------------------------------
-- rounds.parent_round_id exists since the initial schema; here it gets an index and its rules.
create index if not exists rounds_parent_round_id_idx on public.rounds (parent_round_id);

-- A follow-up round belongs to the same team as its origin, and the origin must be closed or decided.
create function public.check_parent_round()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  parent public.rounds;
begin
  if new.parent_round_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.parent_round_id is not distinct from old.parent_round_id then
    return new;
  end if;
  select * into parent from public.rounds where id = new.parent_round_id;
  if not found or parent.team_id <> new.team_id then
    raise exception 'origin round must belong to the same team' using errcode = 'P0001', hint = 'invalid_parent';
  end if;
  if parent.status = 'open' then
    raise exception 'origin round is still open' using errcode = 'P0001', hint = 'parent_open';
  end if;
  return new;
end;
$$;
create trigger check_parent_round
  before insert or update of parent_round_id on public.rounds
  for each row execute function public.check_parent_round();

-- ---------------------------------------------------------------------------
-- Decisions
-- ---------------------------------------------------------------------------
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null unique references public.rounds (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  body text not null check (char_length(body) between 3 and 2000),
  rationale text not null check (char_length(rationale) between 3 and 4000),
  -- Indexes of the perspective-map clusters the rationale refers to (analyses.map.clusters).
  cluster_refs integer[] not null default '{}',
  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index decisions_team_id_idx on public.decisions (team_id, created_at desc);

create table public.decision_reads (
  decision_id uuid not null references public.decisions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (decision_id, user_id)
);

-- The status "decided" only comes with a decision row (written by decide_round below).
create or replace function public.guard_round_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not ((old.status = 'open' and new.status = 'closed') or (old.status = 'closed' and new.status = 'decided')) then
      raise exception 'invalid status change from % to %', old.status, new.status
        using errcode = 'P0001', hint = 'invalid_status';
    end if;
    if new.status = 'decided' and not exists (select 1 from public.decisions where round_id = old.id) then
      raise exception 'a round is decided only together with a decision' using errcode = 'P0001', hint = 'decision_missing';
    end if;
    if new.status = 'closed' then
      new.closed_at := now();
    end if;
  else
    new.closed_at := old.closed_at;
  end if;

  if (new.question is distinct from old.question or new.context is distinct from old.context)
     and exists (select 1 from public.responses where round_id = old.id) then
    raise exception 'question cannot change after the first answer' using errcode = 'P0001', hint = 'question_frozen';
  end if;

  if new.deadline is distinct from old.deadline and (old.status <> 'open' or new.deadline <= now()) then
    raise exception 'deadline can only move into the future while the round is open'
      using errcode = 'P0001', hint = 'invalid_deadline';
  end if;

  return new;
end;
$$;

-- Record the decision for a closed round: creator of the round or team lead, never a guest.
-- Writes the decision and sets the round to "decided" in one step. The decider has read it.
create function public.decide_round(p_round_id uuid, p_body text, p_rationale text, p_cluster_refs integer[] default '{}')
returns public.decisions
language plpgsql security definer set search_path = ''
as $$
declare
  r public.rounds;
  d public.decisions;
begin
  select * into r from public.rounds where id = p_round_id;
  if not found or not public.is_team_member(r.team_id) then
    raise exception 'round not found' using errcode = 'P0002';
  end if;
  if public.is_guest_for_team(r.team_id)
     or not (r.created_by = (select auth.uid()) or public.is_team_lead(r.team_id)) then
    raise exception 'only the round creator or team lead can decide' using errcode = '42501';
  end if;
  if r.status = 'open' then
    raise exception 'round is still open' using errcode = 'P0001', hint = 'round_open';
  end if;
  if r.status = 'decided' then
    raise exception 'round is already decided' using errcode = 'P0001', hint = 'already_decided';
  end if;

  insert into public.decisions (round_id, team_id, body, rationale, cluster_refs, decided_by)
  values (r.id, r.team_id, trim(p_body), trim(p_rationale), coalesce(p_cluster_refs, '{}'), (select auth.uid()))
  returning * into d;
  update public.rounds set status = 'decided' where id = r.id;
  insert into public.decision_reads (decision_id, user_id) values (d.id, (select auth.uid()));
  return d;
end;
$$;
revoke execute on function public.decide_round(uuid, text, text, integer[]) from public, anon;
grant execute on function public.decide_round(uuid, text, text, integer[]) to authenticated;

-- How many team members have confirmed reading, out of how many. Numbers only.
create function public.decision_read_count(p_decision_id uuid)
returns table (read_count integer, member_count integer)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*)::int from public.decision_reads dr
       join public.team_members tm on tm.user_id = dr.user_id and tm.team_id = d.team_id
       where dr.decision_id = d.id),
    (select count(*)::int from public.team_members tm where tm.team_id = d.team_id)
  from public.decisions d
  where d.id = p_decision_id and public.is_team_member(d.team_id);
$$;
revoke execute on function public.decision_read_count(uuid) from public, anon;
grant execute on function public.decision_read_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------
revoke all on public.decisions, public.decision_reads from anon;
-- Decisions are written only through decide_round and never changed.
revoke insert, update, delete on public.decisions from authenticated;
revoke update on public.decision_reads from authenticated;

alter table public.decisions enable row level security;
alter table public.decision_reads enable row level security;

create policy "decisions_select" on public.decisions for select to authenticated
  using (public.is_team_member(team_id));

-- Your own read receipts only: you confirm for yourself, and nobody sees who has not read.
create policy "decision_reads_select_own" on public.decision_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy "decision_reads_insert_own" on public.decision_reads for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.decisions d where d.id = decision_id and public.is_team_member(d.team_id))
  );

alter publication supabase_realtime add table public.decisions;
