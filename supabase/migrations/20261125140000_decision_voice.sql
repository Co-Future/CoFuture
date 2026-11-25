-- Roadmap 7c: dictate a decision. The transcription job of a closed exchange may be queued only by
-- the people who may decide (round creator or team lead, no guests), and only while there is no decision.
-- The job splits the transcript into decision and rationale (lib/jobs/structure.ts, purpose "decision").

create policy "jobs_insert_transcribe_decision" on public.analysis_jobs for insert to authenticated
  with check (
    kind = 'transcribe'
    and status = 'pending'
    and attempts = 0
    and team_id is null
    and created_by = (select auth.uid())
    and payload ->> 'purpose' = 'decision'
    and payload ->> 'path' like (select auth.uid())::text || '/%'
    and exists (
      select 1 from public.rounds r
      where r.id = round_id
        and r.status = 'closed'
        and not exists (select 1 from public.decisions d where d.round_id = r.id)
        and public.is_team_member(r.team_id)
        and not public.is_guest_for_team(r.team_id)
        and (r.created_by = (select auth.uid()) or public.is_team_lead(r.team_id))
    )
  );
