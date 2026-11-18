-- Step 7c, second part (decision Constantin, 18.11.2026, see ADR 012):
--   - The person who starts an exchange chooses which questions they answer themselves.
--   - Answers and follow-up questions show the display name (chosen by each person) instead of A01.
--     Pseudonyms stay as internal source ids; only they go to the model.
--   - The analysis has a short cross-section summary per question ("Stimmungsbild").

alter table public.round_questions add column asks_starter boolean not null default false;

-- Is this question addressed to me?
--   - I am a target, or
--   - I started the exchange and chose to answer it myself, or
--   - it has no targets (everyone) and I did not start the exchange.
create or replace function public.question_is_for_me(p_question_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.round_questions q
    join public.rounds r on r.id = q.round_id
    where q.id = p_question_id
      and (
        exists (select 1 from public.round_question_targets t where t.question_id = q.id and t.user_id = (select auth.uid()))
        or (r.created_by = (select auth.uid()) and q.asks_starter)
        or (
          not exists (select 1 from public.round_question_targets t where t.question_id = q.id)
          and r.created_by is distinct from (select auth.uid())
        )
      )
  );
$$;

-- p_questions: [{ "body": text, "targets": [user id, …], "asks_starter": boolean }]
create or replace function public.create_exchange(
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

  -- Title in lists: the first question for everyone, so a targeted question never shows up there.
  insert into public.rounds (team_id, question, context, deadline, parent_round_id, created_by)
  values (
    p_team_id,
    coalesce(
      (select trim(e ->> 'body') from jsonb_array_elements(p_questions) e
       where jsonb_array_length(coalesce(e -> 'targets', '[]'::jsonb)) = 0 limit 1),
      trim(p_questions -> 0 ->> 'body')
    ),
    nullif(trim(coalesce(p_context, '')), ''), p_deadline, p_parent_round_id, (select auth.uid())
  )
  returning id into new_id;

  for q in select * from jsonb_array_elements(p_questions) loop
    insert into public.round_questions (round_id, position, body, asks_starter)
    values (new_id, pos, trim(q ->> 'body'), coalesce((q ->> 'asks_starter')::boolean, false))
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

-- Answers with the display name of the person who answered (pseudonym stays as a stable key).
create or replace view public.round_answers with (security_invoker = false) as
select
  ra.id,
  q.round_id,
  ra.question_id,
  resp.pseudonym,
  resp.source,
  ra.body,
  ra.updated_at,
  (resp.author_id = (select auth.uid())) as is_own,
  p.display_name as author_name
from public.response_answers ra
join public.responses resp on resp.id = ra.response_id
join public.round_questions q on q.id = ra.question_id
join public.rounds ro on ro.id = q.round_id
left join public.profiles p on p.id = resp.author_id
where public.can_see_question(q.id)
  and (ro.status <> 'open' or resp.author_id = (select auth.uid()));

-- Follow-up questions with the name of the person who asked (only they and the starter see them).
create or replace view public.round_clarifications_public with (security_invoker = false) as
select
  c.id,
  c.round_id,
  c.question_id,
  c.body,
  c.answer,
  c.answered_at,
  c.created_at,
  (c.author_id = (select auth.uid())) as is_own,
  p.display_name as author_name
from public.round_clarifications c
join public.rounds ro on ro.id = c.round_id
left join public.profiles p on p.id = c.author_id
where public.is_team_member(ro.team_id)
  and (c.author_id = (select auth.uid()) or ro.created_by = (select auth.uid()));

-- The analysis as this person may see it, now including the summary per question.
create or replace function public.round_analysis(p_round_id uuid)
returns table (map jsonb, model text, prompt_version text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select
    jsonb_build_object(
      'clusters', coalesce((
        select jsonb_agg(
          case when c ->> 'question_id' is null or public.can_see_question((c ->> 'question_id')::uuid) then c end
          order by ord)
        from jsonb_array_elements(a.map -> 'clusters') with ordinality as x(c, ord)
      ), '[]'::jsonb),
      'open_questions', coalesce((
        select jsonb_agg(o order by ord)
        from jsonb_array_elements(a.map -> 'open_questions') with ordinality as y(o, ord)
        where o ->> 'question_id' is null or public.can_see_question((o ->> 'question_id')::uuid)
      ), '[]'::jsonb),
      'overviews', coalesce((
        select jsonb_agg(v order by ord)
        from jsonb_array_elements(coalesce(a.map -> 'overviews', '[]'::jsonb)) with ordinality as z(v, ord)
        where v ->> 'question_id' is null or public.can_see_question((v ->> 'question_id')::uuid)
      ), '[]'::jsonb)
    ),
    a.model, a.prompt_version, a.created_at
  from public.analyses a
  where a.round_id = p_round_id and public.can_see_round(p_round_id);
$$;
