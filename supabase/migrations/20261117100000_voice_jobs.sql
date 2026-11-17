-- Voice answers: private audio bucket, job queue (ADR 009) and a safe way for the worker to claim jobs.

-- ---------------------------------------------------------------------------
-- Job queue
-- ---------------------------------------------------------------------------
create type public.job_kind as enum ('transcribe', 'analyze');
create type public.job_status as enum ('pending', 'running', 'done', 'failed');

create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  kind public.job_kind not null,
  status public.job_status not null default 'pending',
  round_id uuid not null references public.rounds (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  attempts int not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index analysis_jobs_open_idx on public.analysis_jobs (kind, created_at) where status in ('pending', 'running');

create trigger on_job_update
  before update on public.analysis_jobs
  for each row execute function public.touch_updated_at();

alter table public.analysis_jobs enable row level security;
revoke all on public.analysis_jobs from anon;
revoke update, delete on public.analysis_jobs from authenticated;

-- People see only their own jobs. Transcripts are private until they are saved as an answer.
create policy "jobs_select_own" on public.analysis_jobs for select to authenticated
  using (created_by = (select auth.uid()));

-- People may queue a transcription for their own upload in an open round of their team.
create policy "jobs_insert_transcribe" on public.analysis_jobs for insert to authenticated
  with check (
    kind = 'transcribe'
    and status = 'pending'
    and attempts = 0
    and created_by = (select auth.uid())
    and payload ->> 'path' like (select auth.uid())::text || '/%'
    and exists (
      select 1 from public.rounds r
      where r.id = round_id and r.status = 'open' and r.deadline > now() and public.is_team_member(r.team_id)
    )
  );

-- Live status updates for the person who queued the job (RLS applies).
alter publication supabase_realtime add table public.analysis_jobs;

-- Claims up to p_limit runnable jobs for the worker. A job is runnable when pending, or when it has
-- been running for over 5 minutes (worker died), with fewer than 3 attempts. SKIP LOCKED lets several
-- workers run side by side without taking the same job. Only the server (secret key) may call this.
create function public.claim_jobs(p_kind public.job_kind, p_limit int default 5, p_job_id uuid default null)
returns setof public.analysis_jobs
language sql security definer set search_path = ''
as $$
  update public.analysis_jobs j
  set status = 'running', locked_at = now(), attempts = j.attempts + 1, error = null
  where j.id in (
    select id from public.analysis_jobs
    where kind = p_kind
      and (p_job_id is null or id = p_job_id)
      and attempts < 3
      and (status = 'pending' or (status = 'running' and locked_at < now() - interval '5 minutes'))
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning j.*;
$$;
revoke execute on function public.claim_jobs(public.job_kind, int, uuid) from public, anon, authenticated;
grant execute on function public.claim_jobs(public.job_kind, int, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Audio storage: private bucket, 25 MB per file (the speech-to-text limit)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice', 'voice', false, 26214400, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']);

-- Upload only into your own folder ({user id}/…). No reading, listing or deleting: only the worker
-- (secret key, bypasses RLS) reads the file and deletes it right after transcription.
create policy "voice_upload_own_folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'voice' and (storage.foldername(name))[1] = (select auth.uid())::text);
