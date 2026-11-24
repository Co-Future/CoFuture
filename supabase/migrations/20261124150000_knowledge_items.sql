-- Step 8a: knowledge store (ADR 006, ADR 013).
-- Results of exchanges become searchable across the organization:
--   - summary per question (overview) and clusters of the perspective map
--   - decisions with rationale
-- Single answers are not stored here; they stay reachable as linked sources.
-- Every item has exactly the visibility of its original (RLS below), including questions
-- addressed only to some people (ADR 012).
-- Items are written by triggers in SQL, so they are complete without any AI call.
-- The embedding for meaning-based search is added later by a job (lib/jobs/embed.ts);
-- until then the item is already found by full-text search.

create extension if not exists vector with schema extensions;

create type public.knowledge_kind as enum ('overview', 'cluster', 'decision');

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  round_id uuid not null references public.rounds (id) on delete cascade,
  question_id uuid references public.round_questions (id) on delete cascade,
  decision_id uuid references public.decisions (id) on delete cascade,
  kind public.knowledge_kind not null,
  -- consensus, dissent, single_voice, off_topic for clusters; null otherwise
  cluster_kind text,
  -- position in analyses.map.clusters (links back to the map)
  cluster_index integer,
  question text not null,
  title text not null,
  content text not null,
  search tsvector generated always as (
    setweight(to_tsvector('german'::regconfig, title), 'A')
    || setweight(to_tsvector('german'::regconfig, question), 'B')
    || setweight(to_tsvector('german'::regconfig, content), 'C')
  ) stored,
  embedding extensions.vector(768),
  embedding_model text,
  embed_attempts integer not null default 0,
  embed_locked_at timestamptz,
  created_at timestamptz not null default now()
);

create index knowledge_items_org_idx on public.knowledge_items (organization_id, created_at desc);
create index knowledge_items_round_idx on public.knowledge_items (round_id);
create index knowledge_items_search_idx on public.knowledge_items using gin (search);
create index knowledge_items_embedding_idx on public.knowledge_items
  using hnsw (embedding extensions.vector_cosine_ops);
create index knowledge_items_pending_idx on public.knowledge_items (created_at) where embedding is null;

-- ---------------------------------------------------------------------------
-- Visibility: exactly like the original
-- ---------------------------------------------------------------------------
create function public.can_see_knowledge(p_kind public.knowledge_kind, p_round_id uuid, p_question_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    -- summary or cluster of one question: whoever may see that question
    when p_question_id is not null then public.can_see_question(p_question_id)
    -- decisions: like the decisions table
    when p_kind = 'decision' then public.can_see_round(p_round_id)
    -- older maps without questions: like the analyses table
    else public.can_see_round(p_round_id) and not public.round_has_hidden_questions(p_round_id)
  end;
$$;
revoke execute on function public.can_see_knowledge(public.knowledge_kind, uuid, uuid) from public, anon;
grant execute on function public.can_see_knowledge(public.knowledge_kind, uuid, uuid) to authenticated;

revoke all on public.knowledge_items from anon;
revoke insert, update, delete on public.knowledge_items from authenticated;
alter table public.knowledge_items enable row level security;
create policy "knowledge_items_select" on public.knowledge_items for select to authenticated
  using (public.can_see_knowledge(kind, round_id, question_id));

-- ---------------------------------------------------------------------------
-- Keeping the store in sync
-- ---------------------------------------------------------------------------

-- Rebuilds the items of one round's perspective map (summaries and clusters).
create function public.sync_analysis_knowledge(p_round_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  m jsonb;
begin
  select ro.id, ro.team_id, ro.question, t.organization_id into r
  from public.rounds ro join public.teams t on t.id = ro.team_id
  where ro.id = p_round_id;
  if not found then
    return;
  end if;
  select a.map into m from public.analyses a where a.round_id = p_round_id;

  delete from public.knowledge_items where round_id = p_round_id and kind in ('overview', 'cluster');
  if m is null then
    return;
  end if;

  -- Summary per question
  insert into public.knowledge_items (organization_id, team_id, round_id, question_id, kind, question, title, content)
  select r.organization_id, r.team_id, r.id, q.id, 'overview', coalesce(q.body, r.question), 'Zusammenfassung', trim(v ->> 'text')
  from jsonb_array_elements(coalesce(m -> 'overviews', '[]'::jsonb)) v
  left join public.round_questions q on q.id::text = v ->> 'question_id' and q.round_id = r.id
  where coalesce(trim(v ->> 'text'), '') <> '';

  -- Clusters (without the technical "unassigned" bucket)
  insert into public.knowledge_items
    (organization_id, team_id, round_id, question_id, kind, cluster_kind, cluster_index, question, title, content)
  select r.organization_id, r.team_id, r.id, q.id, 'cluster', c ->> 'kind', (ord - 1)::int,
         coalesce(q.body, r.question), trim(c ->> 'title'), trim(c ->> 'summary')
  from jsonb_array_elements(coalesce(m -> 'clusters', '[]'::jsonb)) with ordinality as x(c, ord)
  left join public.round_questions q on q.id::text = c ->> 'question_id' and q.round_id = r.id
  where c ->> 'kind' is distinct from 'unassigned'
    and coalesce(trim(c ->> 'title'), '') <> ''
    and coalesce(trim(c ->> 'summary'), '') <> '';
end;
$$;
revoke execute on function public.sync_analysis_knowledge(uuid) from public, anon, authenticated;

create function public.on_analysis_knowledge()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.sync_analysis_knowledge(new.round_id);
  return new;
end;
$$;
create trigger analyses_knowledge
  after insert or update of map on public.analyses
  for each row execute function public.on_analysis_knowledge();

create function public.on_decision_knowledge()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.knowledge_items (organization_id, team_id, round_id, decision_id, kind, question, title, content)
  select t.organization_id, new.team_id, new.round_id, new.id, 'decision', ro.question, new.body,
         new.body || E'\n\nBegründung: ' || new.rationale
  from public.rounds ro join public.teams t on t.id = ro.team_id
  where ro.id = new.round_id;
  return new;
end;
$$;
create trigger decisions_knowledge
  after insert on public.decisions
  for each row execute function public.on_decision_knowledge();

-- Embedding job: hands out items without an embedding, each to one worker only.
create function public.claim_knowledge_items(p_limit int default 50)
returns table (id uuid, question text, title text, content text, kind public.knowledge_kind)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  update public.knowledge_items k
  set embed_locked_at = now(), embed_attempts = k.embed_attempts + 1
  where k.id in (
    select i.id from public.knowledge_items i
    where i.embedding is null
      and i.embed_attempts < 5
      and (i.embed_locked_at is null or i.embed_locked_at < now() - interval '5 minutes')
    order by i.created_at
    limit p_limit
    for update skip locked
  )
  returning k.id, k.question, k.title, k.content, k.kind;
end;
$$;
revoke execute on function public.claim_knowledge_items(int) from public, anon, authenticated;
grant execute on function public.claim_knowledge_items(int) to service_role;

-- ---------------------------------------------------------------------------
-- Existing results
-- ---------------------------------------------------------------------------
do $$
declare
  a record;
begin
  for a in select round_id from public.analyses loop
    perform public.sync_analysis_knowledge(a.round_id);
  end loop;
end;
$$;

insert into public.knowledge_items (organization_id, team_id, round_id, decision_id, kind, question, title, content)
select t.organization_id, d.team_id, d.round_id, d.id, 'decision', ro.question, d.body,
       d.body || E'\n\nBegründung: ' || d.rationale
from public.decisions d
join public.rounds ro on ro.id = d.round_id
join public.teams t on t.id = d.team_id;
