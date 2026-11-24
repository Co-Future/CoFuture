-- Step 8b: hybrid search in the knowledge store (ADR 013).
-- Full-text search (german) and meaning-based search (pgvector) are merged with
-- Reciprocal Rank Fusion. The function runs with the rights of the caller (security invoker),
-- so the RLS policy on knowledge_items decides what can be found.

create function public.search_knowledge(
  p_organization_id uuid,
  p_query text,
  p_embedding extensions.vector(768) default null,
  p_team_id uuid default null,
  p_min_similarity double precision default 0.65,
  p_limit integer default 20
)
returns table (
  id uuid,
  kind public.knowledge_kind,
  cluster_kind text,
  title text,
  question text,
  content text,
  snippet text,
  round_id uuid,
  question_id uuid,
  team_id uuid,
  created_at timestamptz,
  score double precision,
  matched_text boolean,
  similarity double precision
)
language sql stable security invoker set search_path = ''
as $$
  with params as (
    select websearch_to_tsquery('german'::regconfig, coalesce(p_query, '')) as tsq
  ),
  scope as (
    select k.* from public.knowledge_items k
    where k.organization_id = p_organization_id
      and (p_team_id is null or k.team_id = p_team_id)
  ),
  text_hits as (
    select s.id, row_number() over (order by ts_rank_cd(s.search, p.tsq) desc, s.created_at desc) as rank
    from scope s, params p
    where s.search @@ p.tsq
    limit 50
  ),
  vector_hits as (
    select v.id, v.similarity, row_number() over (order by v.similarity desc) as rank
    from (
      select s.id, 1 - (s.embedding operator(extensions.<=>) p_embedding) as similarity
      from scope s
      where p_embedding is not null and s.embedding is not null
      order by s.embedding operator(extensions.<=>) p_embedding
      limit 50
    ) v
    where v.similarity >= p_min_similarity
  ),
  fused as (
    select coalesce(t.id, v.id) as id,
           coalesce(1.0 / (60 + t.rank), 0) + coalesce(1.0 / (60 + v.rank), 0) as score,
           t.id is not null as matched_text,
           v.similarity
    from text_hits t full outer join vector_hits v on v.id = t.id
  )
  select k.id, k.kind, k.cluster_kind, k.title, k.question, k.content,
         ts_headline('german'::regconfig, k.content, p.tsq,
                     'StartSel=[[, StopSel=]], MaxWords=40, MinWords=15, ShortWord=2, HighlightAll=false') as snippet,
         k.round_id, k.question_id, k.team_id, k.created_at,
         f.score::double precision, f.matched_text, f.similarity
  from fused f
  join public.knowledge_items k on k.id = f.id
  cross join params p
  order by f.score desc, k.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;
revoke execute on function public.search_knowledge(uuid, text, extensions.vector, uuid, double precision, integer) from public, anon;
grant execute on function public.search_knowledge(uuid, text, extensions.vector, uuid, double precision, integer) to authenticated;

-- Embeddings now carry a short task prefix ("title: … | text: …"), which separates
-- relevant from unrelated hits much better. Recompute the few existing vectors.
update public.knowledge_items set embedding = null, embedding_model = null, embed_attempts = 0, embed_locked_at = null;

-- The embedding job passes its current model marker; items embedded with another marker
-- (older model or text format) are recomputed automatically.
drop function public.claim_knowledge_items(int);
create function public.claim_knowledge_items(p_limit int default 50, p_model text default null)
returns table (id uuid, question text, title text, content text, kind public.knowledge_kind)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  update public.knowledge_items k
  set embed_locked_at = now(), embed_attempts = k.embed_attempts + 1
  where k.id in (
    select i.id from public.knowledge_items i
    where (i.embedding is null or (p_model is not null and i.embedding_model is distinct from p_model))
      and i.embed_attempts < 5
      and (i.embed_locked_at is null or i.embed_locked_at < now() - interval '5 minutes')
    order by i.embedding is not null, i.created_at
    limit p_limit
    for update skip locked
  )
  returning k.id, k.question, k.title, k.content, k.kind;
end;
$$;
revoke execute on function public.claim_knowledge_items(int, text) from public, anon, authenticated;
grant execute on function public.claim_knowledge_items(int, text) to service_role;
