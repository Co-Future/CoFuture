import type { SupabaseClient } from "@supabase/supabase-js";
import { embedTexts, MIN_SIMILARITY, queryText, toVectorLiteral } from "@/lib/ai/embed";
import { answerFromKnowledge } from "@/lib/ai/knowledge-answer";
import type { Database } from "@/lib/db/types";

export type KnowledgeHit = {
  id: string;
  kind: "overview" | "cluster" | "decision";
  clusterKind: string | null;
  title: string;
  question: string;
  /** Excerpt with matches marked as [[…]] (full-text hits), otherwise the start of the content. */
  snippet: string;
  roundId: string;
  questionId: string | null;
  teamId: string;
  createdAt: string;
  /** How the hit was found: by words, by meaning, or both. */
  matchedText: boolean;
  matchedMeaning: boolean;
};

export type KnowledgeSearch = {
  hits: KnowledgeHit[];
  /** "text" when the meaning-based part was not available (Gemini down or not configured). */
  mode: "hybrid" | "text";
};

/**
 * Hybrid search (ADR 013). Runs with the rights of the signed-in person: the database only
 * returns items whose original they may see. Only the query text goes to Gemini.
 */
export async function searchKnowledge(
  supabase: SupabaseClient<Database>,
  input: { organizationId: string; query: string; teamId?: string; limit?: number },
): Promise<KnowledgeSearch> {
  let embedding: string | undefined;
  try {
    const [vector] = await embedTexts([queryText(input.query)]);
    embedding = toVectorLiteral(vector);
  } catch (error) {
    console.warn("knowledge search without embedding", String(error));
  }

  const { data, error } = await supabase.rpc("search_knowledge", {
    p_organization_id: input.organizationId,
    p_query: input.query,
    p_embedding: embedding,
    p_team_id: input.teamId,
    p_min_similarity: MIN_SIMILARITY,
    p_limit: input.limit ?? 20,
  });
  if (error) throw error;

  return {
    mode: embedding ? "hybrid" : "text",
    hits: (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      clusterKind: row.cluster_kind,
      title: row.title,
      question: row.question,
      snippet: row.matched_text ? row.snippet : row.content,
      roundId: row.round_id,
      questionId: row.question_id,
      teamId: row.team_id,
      createdAt: row.created_at,
      matchedText: row.matched_text,
      matchedMeaning: row.similarity !== null,
    })),
  };
}

/** The newest items of the organization (RLS applies), for the page before anyone searches. */
export async function recentKnowledge(
  supabase: SupabaseClient<Database>,
  input: { organizationId: string; teamId?: string; limit?: number },
): Promise<KnowledgeHit[]> {
  let query = supabase
    .from("knowledge_items")
    .select("id, kind, cluster_kind, title, question, content, round_id, question_id, team_id, created_at")
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 10);
  if (input.teamId) query = query.eq("team_id", input.teamId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    clusterKind: row.cluster_kind,
    title: row.title,
    question: row.question,
    snippet: row.content,
    roundId: row.round_id,
    questionId: row.question_id,
    teamId: row.team_id,
    createdAt: row.created_at,
    matchedText: false,
    matchedMeaning: false,
  }));
}

/** Splits a snippet into plain and highlighted parts ([[match]]), for safe rendering without HTML. */
export function snippetParts(snippet: string): { text: string; mark: boolean }[] {
  return snippet
    .split(/(\[\[.*?\]\])/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("[[") && part.endsWith("]]") ? { text: part.slice(2, -2), mark: true } : { text: part, mark: false },
    );
}

export type KnowledgeAnswer = {
  /** Statements with the hits they rely on. Empty: the store holds nothing reliable on this. */
  statements: { text: string; sources: KnowledgeHit[] }[];
  /** Every hit that was given to AsyncMeet, in order. */
  consulted: KnowledgeHit[];
  mode: KnowledgeSearch["mode"];
  model: string | null;
  promptVersion: string | null;
};

/**
 * Question with evidence (step 8c): search first, then let AsyncMeet answer only from the hits.
 * Without hits no model is called at all.
 */
export async function askKnowledge(
  supabase: SupabaseClient<Database>,
  input: { organizationId: string; question: string; teamId?: string },
): Promise<KnowledgeAnswer> {
  const search = await searchKnowledge(supabase, { ...input, query: input.question, limit: 8 });
  if (search.hits.length === 0) return { statements: [], consulted: [], mode: search.mode, model: null, promptVersion: null };

  // Full content for the model, not the excerpt.
  const { data: rows } = await supabase
    .from("knowledge_items")
    .select("id, content")
    .in(
      "id",
      search.hits.map((h) => h.id),
    );
  const content = new Map((rows ?? []).map((r) => [r.id, r.content]));
  const kindLabel = { overview: "Zusammenfassung", cluster: "Themengruppe", decision: "Beschluss" } as const;
  const sources = search.hits.map((h, i) => ({
    id: `Q${i + 1}`,
    hit: h,
    kind: kindLabel[h.kind],
    title: h.title,
    question: h.question,
    content: content.get(h.id) ?? h.snippet,
    date: h.createdAt.slice(0, 10),
  }));

  const answer = await answerFromKnowledge(input.question, sources);
  const byId = new Map(sources.map((s) => [s.id, s.hit]));
  return {
    statements: answer.statements.map((s) => ({ text: s.text, sources: s.sourceIds.map((id) => byId.get(id)!) })),
    consulted: search.hits,
    mode: search.mode,
    model: answer.model,
    promptVersion: answer.promptVersion,
  };
}
