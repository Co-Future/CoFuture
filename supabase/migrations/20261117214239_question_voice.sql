-- Dictate the question of a new round. The round does not exist yet, so a transcription job can
-- belong to a team instead of a round. The worker transcribes the audio and AsyncMeet suggests
-- question and context; the person checks both before starting the round.

alter table public.analysis_jobs
  add column team_id uuid references public.teams (id) on delete cascade,
  alter column round_id drop not null,
  add constraint analysis_jobs_target check (
    (kind = 'analyze' and round_id is not null)
    or (kind = 'transcribe' and (round_id is not null or team_id is not null))
  );
create index analysis_jobs_team_id_idx on public.analysis_jobs (team_id) where team_id is not null;

-- Queue a question transcription for your own upload in a team where you may start rounds (no guests).
create policy "jobs_insert_transcribe_question" on public.analysis_jobs for insert to authenticated
  with check (
    kind = 'transcribe'
    and status = 'pending'
    and attempts = 0
    and round_id is null
    and team_id is not null
    and created_by = (select auth.uid())
    and payload ->> 'path' like (select auth.uid())::text || '/%'
    and public.is_team_member(team_id)
    and not public.is_guest_for_team(team_id)
  );
