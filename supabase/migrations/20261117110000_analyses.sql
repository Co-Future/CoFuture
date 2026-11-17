-- Perspective map: closing a round queues an analysis job; the worker stores the result in analyses.
-- Same view for everyone: every member of the team sees the same map.

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null unique references public.rounds (id) on delete cascade,
  job_id uuid references public.analysis_jobs (id) on delete set null,
  map jsonb not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  response_count int not null,
  covered_count int not null,
  duration_ms int,
  created_at timestamptz not null default now()
);

alter table public.analyses enable row level security;
revoke all on public.analyses from anon;
revoke insert, update, delete on public.analyses from authenticated;

create policy "analyses_select_team" on public.analyses for select to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id and public.is_team_member(r.team_id)));

alter publication supabase_realtime add table public.analyses;

-- Analysis jobs belong to the round, not to one person: every member may see their status.
alter table public.analysis_jobs alter column created_by drop not null;
create policy "jobs_select_analyze_team" on public.analysis_jobs for select to authenticated
  using (
    kind = 'analyze'
    and exists (select 1 from public.rounds r where r.id = round_id and public.is_team_member(r.team_id))
  );

-- Closing a round with at least one answer queues exactly one analysis job.
create function public.enqueue_analysis()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'open' and new.status = 'closed'
     and exists (select 1 from public.responses where round_id = new.id)
     and not exists (select 1 from public.analysis_jobs where round_id = new.id and kind = 'analyze') then
    insert into public.analysis_jobs (kind, round_id, created_by)
    values ('analyze', new.id, new.created_by);
  end if;
  return new;
end;
$$;
create trigger enqueue_analysis
  after update of status on public.rounds
  for each row execute function public.enqueue_analysis();
