import { serverEnv } from "@/lib/env";

/**
 * Embedding adapter for the knowledge store (ADR 006, ADR 013).
 * Gemini only: there is no free fallback for embeddings. If Gemini fails, items stay without an
 * embedding and are retried later; full-text search still finds them in the meantime.
 */

export const EMBEDDING_MODEL = "gemini-embedding-2";
/**
 * Stored in knowledge_items.embedding_model. Change it whenever model, size or text format change:
 * the job then recomputes every vector with another marker by itself.
 */
export const EMBEDDING_MARKER = `${EMBEDDING_MODEL}:768:prefix-v1`;
/** Minimum cosine similarity for a meaning-based hit (measured with made-up German examples, ADR 013). */
export const MIN_SIMILARITY = 0.65;
/** Fixed size of knowledge_items.embedding. Changing it means re-embedding everything. */
export const EMBEDDING_DIMENSIONS = 768;
/** Gemini accepts up to 100 texts per batch request. */
const BATCH_SIZE = 100;
const TIMEOUT_MS = 20_000;

export class EmbedError extends Error {
  constructor(
    message: string,
    readonly retriable: boolean,
  ) {
    super(message);
  }
}

/** Unit length, so cosine distance is meaningful even if the model does not normalise. */
export function normalize(vector: number[]): number[] {
  const length = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return length > 0 ? vector.map((x) => x / length) : vector;
}

/** Postgres literal for a pgvector column. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * One embedding per text, in the same order. Texts hold no names or e-mail addresses.
 * Use knowledgeText() for stored items and queryText() for search queries: the short task prefixes
 * separate relevant from unrelated hits much better than without.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = serverEnv().GEMINI_API_KEY;
  if (!apiKey) throw new EmbedError("GEMINI_API_KEY is not configured.", false);

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    }).catch((error: unknown) => {
      throw new EmbedError(`gemini embed: ${String(error)}`, true);
    });
    if (!res.ok) {
      const body = await res.text();
      throw new EmbedError(`gemini embed ${res.status}: ${body.slice(0, 200)}`, res.status === 429 || res.status >= 500);
    }
    const body = (await res.json()) as { embeddings?: { values?: number[] }[] };
    const vectors = (body.embeddings ?? []).map((e) => e.values ?? []);
    if (vectors.length !== batch.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
      throw new EmbedError("gemini embed: unexpected response shape", true);
    }
    out.push(...vectors.map(normalize));
  }
  return out;
}

/** The text that represents a knowledge item for search: title, question and content. */
export function knowledgeText(item: { question: string; title: string; content: string }): string {
  return `title: ${item.title} | text: Frage: ${item.question}\n${item.content}`;
}

/** The text for a search query. */
export function queryText(query: string): string {
  return `task: search result | query: ${query}`;
}
