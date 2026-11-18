-- Step 7c: an exchange (formerly "round") has several questions. Each question can address only some
-- team members. People answer every question addressed to them, ask questions back, and the analysis
-- runs per question. See ADR 012.
--
-- Rules (design principles):
--   - Same view for all: everyone in the team sees all questions, targets, follow-up questions and,
--     after closing, all answers. Targets change who is asked, never who sees.
--   - Pseudonyms: answers stay pseudonymous (A01 …). Follow-up questions show no author to others.
--   - People decide: questions are written or confirmed by a person; AsyncMeet only suggests.

-- ---------------------------------------------------------------------------
-- Deadline is optional. Without one, the exchange stays open until it is closed by hand.
-- ---------------------------------------------------------------------------
alter table public.rounds alter column deadline drop not null;

create or replace function public.round_accepts_answers(p_round_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.rounds r
    where r.id = p_round_id and r.status = 'open' and (r.deadline is null or r.deadline > now())
  );
$$;
revoke execute on function public.round_accepts_answers(uuid) from public, anon;
grant execute on function public.round_accepts_answers(uuid) to authenticated;

drop policy "rounds_insert" on public.rounds;
create policy "rounds_insert" on public.rounds for insert to authenticated
  with check (
    public.is_team_member(team_id) and not public.is_guest_for_team(team_id)
    and created_by = (select auth.uid()) and (deadline is null or deadline > now())
  );

drop policy "responses_insert_open_round" on public.responses;
create policy "responses_insert_open_round" on public.responses for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.round_accepts_answers(round_id)
    and exists (select 1 from public.rounds r where r.id = round_id and public.is_team_member(r.team_id))
  );
drop policy "responses_update_open_round" on public.responses;
create policy "responses_update_open_round" on public.responses for update to authenticated
  using (author_id = (select auth.uid()) and public.round_accepts_answers(round_id))
  with check (author_id = (select auth.uid()));
drop policy "responses_delete_open_round" on public.responses;
create policy "responses_delete_open_round" on public.responses for delete to authenticated
  using (author_id = (select auth.uid()) and public.round_accepts_answers(round_id));

drop policy "jobs_insert_transcribe" on public.analysis_jobs;
create policy "jobs_insert_transcribe" on public.analysis_jobs for insert to authenticated
  with check (
    kind = 'transcribe'
    and status = 'pending'
    and attempts = 0
    and created_by = (select auth.uid())
    and payload ->> 'path' like (select auth.uid())::text || '/%'
    and public.round_accepts_answers(round_id)
    and exists (select 1 from public.rounds r where r.id = round_id and public.is_team_member(r.team_id))
  );

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

  if new.deadline is distinct from old.deadline
     and (old.status <> 'open' or (new.deadline is not null and new.deadline <= now())) then
    raise exception 'deadline can only move into the future while the round is open'
      using errcode = 'P0001', hint = 'invalid_deadline';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Questions and who they address
-- ---------------------------------------------------------------------------
create table public.round_questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  position integer not null check (position between 0 and 49),
  body text not null check (char_length(body) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (round_id, position)
);

-- No rows for a question: it addresses everyone in the team.
create table public.round_question_targets (
  question_id uuid not null references public.round_questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (question_id, user_id)
);
create index round_question_targets_user_idx on public.round_question_targets (user_id);

-- Is this question addressed to me (no targets = everyone)?
create function public.question_is_for_me(p_question_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.round_question_targets where question_id = p_question_id)
      or exists (
        select 1 from public.round_question_targets
        where question_id = p_question_id and user_id = (select auth.uid())
      );
$$;
revoke execute on function public.question_is_for_me(uuid) from public, anon;
grant execute on function public.question_is_for_me(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Answers per question. responses stays the person's envelope (pseudonym, full text).
-- ---------------------------------------------------------------------------
create table public.response_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses (id) on delete cascade,
  question_id uuid not null references public.round_questions (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  updated_at timestamptz not null default now(),
  unique (response_id, question_id)
);
create index response_answers_question_idx on public.response_answers (question_id);

-- ---------------------------------------------------------------------------
-- Follow-up questions to the person who started the exchange (or the team lead)
-- ---------------------------------------------------------------------------
create table public.round_clarifications (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  question_id uuid references public.round_questions (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 3 and 2000),
  answer text check (char_length(answer) between 1 and 4000),
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index round_clarifications_round_idx on public.round_clarifications (round_id, created_at);

-- ---------------------------------------------------------------------------
-- Existing rounds: their single question becomes question 1, each answer its answer to it.
-- ---------------------------------------------------------------------------
insert into public.round_questions (round_id, position, body)
select r.id, 0, r.question from public.rounds r;

insert into public.response_answers (response_id, question_id, body, updated_at)
select resp.id, q.id, resp.body, resp.updated_at
from public.responses resp
join public.round_questions q on q.round_id = resp.round_id and q.position = 0;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Starts an exchange with its questions in one step. Members of the team, no guests.
-- p_questions: [{ "body": text, "targets": [user id, …] }], 1 to 50 questions. The first question
-- also becomes rounds.question (title in lists).
create function public.create_exchange(
  p_team_id uuid,
  p_questions jsonb,
  p_deadline timestamptz default null,
  p_context text default null,
  p_parent_round_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
  q jsonb;
  q_id uuid;
  pos integer := 0;
  target uuid;
begin
  if not public.is_team_member(p_team_id) or public.is_guest_for_team(p_team_id) then
    raise exception 'only team members can start an exchange' using errcode = '42501';
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 50 then
    raise exception 'between 1 and 50 questions' using errcode = 'P0001', hint = 'invalid_questions';
  end if;
  if p_deadline is not null and p_deadline <= now() then
    raise exception 'deadline must be in the future' using errcode = 'P0001', hint = 'invalid_deadline';
  end if;

  insert into public.rounds (team_id, question, context, deadline, parent_round_id, created_by)
  values (p_team_id, trim(p_questions -> 0 ->> 'body'), nullif(trim(coalesce(p_context, '')), ''), p_deadline,
          p_parent_round_id, (select auth.uid()))
  returning id into new_id;

  for q in select * from jsonb_array_elements(p_questions) loop
    insert into public.round_questions (round_id, position, body)
    values (new_id, pos, trim(q ->> 'body'))
    returning id into q_id;
    for target in select (jsonb_array_elements_text(coalesce(q -> 'targets', '[]'::jsonb)))::uuid loop
      if not exists (select 1 from public.team_members where team_id = p_team_id and user_id = target) then
        raise exception 'targets must be team members' using errcode = 'P0001', hint = 'invalid_target';
      end if;
      insert into public.round_question_targets (question_id, user_id) values (q_id, target) on conflict do nothing;
    end loop;
    pos := pos + 1;
  end loop;
  return new_id;
end;
$$;
revoke execute on function public.create_exchange(uuid, jsonb, timestamptz, text, uuid) from public, anon;
grant execute on function public.create_exchange(uuid, jsonb, timestamptz, text, uuid) to authenticated;

-- Saves your answers while the exchange is open. p_answers: [{ "question_id": uuid, "body": text }].
-- Answers left out or empty are removed. Only questions of this exchange that address you.
create function public.save_answers(p_round_id uuid, p_answers jsonb, p_source public.response_source default 'text')
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r public.rounds;
  resp public.responses;
  a jsonb;
  full_text text;
begin
  select * into r from public.rounds where id = p_round_id;
  if not found or not public.is_team_member(r.team_id) then
    raise exception 'round not found' using errcode = 'P0002';
  end if;
  if not public.round_accepts_answers(p_round_id) then
    raise exception 'round is closed' using errcode = 'P0001', hint = 'round_closed';
  end if;
  if jsonb_typeof(p_answers) <> 'array' then
    raise exception 'answers must be a list' using errcode = 'P0001', hint = 'invalid_answers';
  end if;

  for a in select * from jsonb_array_elements(p_answers) loop
    if not exists (
      select 1 from public.round_questions q
      where q.id = (a ->> 'question_id')::uuid and q.round_id = p_round_id
    ) or not public.question_is_for_me((a ->> 'question_id')::uuid) then
      raise exception 'question is not addressed to you' using errcode = 'P0001', hint = 'invalid_question';
    end if;
  end loop;

  -- Full text in question order, kept on responses for counts and older views.
  select string_agg(q.body || E'\n' || trim(x.body), E'\n\n' order by q.position)
  into full_text
  from jsonb_to_recordset(p_answers) as x(question_id uuid, body text)
  join public.round_questions q on q.id = x.question_id
  where char_length(trim(coalesce(x.body, ''))) > 0;

  if full_text is null then
    delete from public.responses where round_id = p_round_id and author_id = (select auth.uid());
    return null;
  end if;

  insert into public.responses (round_id, author_id, body, source)
  values (p_round_id, (select auth.uid()), left(full_text, 10000), p_source)
  on conflict (round_id, author_id) do update set body = excluded.body, source = excluded.source, updated_at = now()
  returning * into resp;

  delete from public.response_answers ra
  where ra.response_id = resp.id
    and ra.question_id not in (
      select x.question_id from jsonb_to_recordset(p_answers) as x(question_id uuid, body text)
      where char_length(trim(coalesce(x.body, ''))) > 0
    );

  insert into public.response_answers (response_id, question_id, body)
  select resp.id, x.question_id, left(trim(x.body), 10000)
  from jsonb_to_recordset(p_answers) as x(question_id uuid, body text)
  where char_length(trim(coalesce(x.body, ''))) > 0
  on conflict (response_id, question_id) do update set body = excluded.body, updated_at = now();

  return resp.pseudonym;
end;
$$;
revoke execute on function public.save_answers(uuid, jsonb, public.response_source) from public, anon;
grant execute on function public.save_answers(uuid, jsonb, public.response_source) to authenticated;

-- Answers a follow-up question: the person who started the exchange or the team lead.
create function public.answer_clarification(p_id uuid, p_answer text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.rounds;
begin
  select ro.* into r from public.round_clarifications c join public.rounds ro on ro.id = c.round_id where c.id = p_id;
  if not found or not public.is_team_member(r.team_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if not (r.created_by = (select auth.uid()) or public.is_team_lead(r.team_id)) then
    raise exception 'only the starter or the team lead answers' using errcode = '42501';
  end if;
  update public.round_clarifications
  set answer = trim(p_answer), answered_by = (select auth.uid()), answered_at = now()
  where id = p_id;
end;
$$;
revoke execute on function public.answer_clarification(uuid, text) from public, anon;
grant execute on function public.answer_clarification(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Views: answers per question (after closing, or your own) and follow-up questions without author
-- ---------------------------------------------------------------------------
create view public.round_answers with (security_invoker = false) as
select
  ra.id,
  q.round_id,
  ra.question_id,
  resp.pseudonym,
  resp.source,
  ra.body,
  ra.updated_at,
  (resp.author_id = (select auth.uid())) as is_own
from public.response_answers ra
join public.responses resp on resp.id = ra.response_id
join public.round_questions q on q.id = ra.question_id
join public.rounds ro on ro.id = q.round_id
where public.is_team_member(ro.team_id)
  and (ro.status <> 'open' or resp.author_id = (select auth.uid()));
revoke all on public.round_answers from anon, authenticated;
grant select on public.round_answers to authenticated;

create view public.round_clarifications_public with (security_invoker = false) as
select
  c.id,
  c.round_id,
  c.question_id,
  c.body,
  c.answer,
  c.answered_at,
  c.created_at,
  (c.author_id = (select auth.uid())) as is_own
from public.round_clarifications c
join public.rounds ro on ro.id = c.round_id
where public.is_team_member(ro.team_id);
revoke all on public.round_clarifications_public from anon, authenticated;
grant select on public.round_clarifications_public to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------
revoke all on public.round_questions, public.round_question_targets, public.response_answers,
  public.round_clarifications from anon;
-- Questions and targets are written only by create_exchange, answers only by save_answers.
revoke insert, update, delete on public.round_questions, public.round_question_targets, public.response_answers
  from authenticated;
revoke update, delete on public.round_clarifications from authenticated;

alter table public.round_questions enable row level security;
alter table public.round_question_targets enable row level security;
alter table public.response_answers enable row level security;
alter table public.round_clarifications enable row level security;

create policy "round_questions_select" on public.round_questions for select to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id and public.is_team_member(r.team_id)));
create policy "round_question_targets_select" on public.round_question_targets for select to authenticated
  using (exists (
    select 1 from public.round_questions q join public.rounds r on r.id = q.round_id
    where q.id = question_id and public.is_team_member(r.team_id)
  ));
-- Your own answers only; everyone else reads through round_answers.
create policy "response_answers_select_own" on public.response_answers for select to authenticated
  using (exists (select 1 from public.responses r where r.id = response_id and r.author_id = (select auth.uid())));
-- Your own follow-up questions; everyone reads through round_clarifications_public.
create policy "round_clarifications_select_own" on public.round_clarifications for select to authenticated
  using (author_id = (select auth.uid()));
create policy "round_clarifications_insert" on public.round_clarifications for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and answer is null and answered_by is null and answered_at is null
    and exists (select 1 from public.rounds r where r.id = round_id and r.status = 'open' and public.is_team_member(r.team_id))
    and (
      question_id is null
      or exists (
        select 1 from public.round_questions q
        where q.id = round_clarifications.question_id and q.round_id = round_clarifications.round_id
      )
    )
  );

alter publication supabase_realtime add table public.round_clarifications;
