import { EMBEDDING_MODEL, embedTexts, EmbedError, knowledgeText, toVectorLiteral } from "@/lib/ai/embed";
import { createAdminClient } from "@/lib/db/admin";

export type EmbedRun = { embedded: number; failed: number };

/**
 * Adds embeddings to knowledge items that have none yet (claim_knowledge_items hands each item
 * to one worker only, max. 5 attempts). Started after an analysis or decision, and by /api/worker.
 */
export async function runEmbedJobs(options: { limit?: number } = {}): Promise<EmbedRun> {
  const admin = createAdminClient();
  const { data: items, error } = await admin.rpc("claim_knowledge_items", { p_limit: options.limit ?? 50 });
  if (error) throw error;
  if (!items || items.length === 0) return { embedded: 0, failed: 0 };

  try {
    const vectors = await embedTexts(items.map(knowledgeText), "RETRIEVAL_DOCUMENT");
    let embedded = 0;
    for (const [i, item] of items.entries()) {
      const { error: updateError } = await admin
        .from("knowledge_items")
        .update({ embedding: toVectorLiteral(vectors[i]), embedding_model: EMBEDDING_MODEL, embed_locked_at: null })
        .eq("id", item.id);
      if (updateError) console.error("embedding not saved", { id: item.id, error: updateError.message });
      else embedded++;
    }
    return { embedded, failed: items.length - embedded };
  } catch (error) {
    // Release the items; they are tried again later (attempts are counted by claim_knowledge_items).
    console.error("embedding failed", {
      count: items.length,
      retriable: error instanceof EmbedError && error.retriable,
      error: String(error),
    });
    await admin
      .from("knowledge_items")
      .update({ embed_locked_at: null })
      .in(
        "id",
        items.map((i) => i.id),
      );
    return { embedded: 0, failed: items.length };
  }
}
