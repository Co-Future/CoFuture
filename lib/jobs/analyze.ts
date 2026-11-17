import { buildPerspectiveMap } from "@/lib/ai/perspective-map";
import { LlmError } from "@/lib/ai/llm";
import { createAdminClient } from "@/lib/db/admin";
import type { Json } from "@/lib/db/types";

const MAX_ATTEMPTS = 3;

export type AnalyzeRun = { processed: number; done: number; failed: number };

/** Claims runnable analysis jobs and builds the perspective map for each round. */
export async function runAnalyzeJobs(options: { jobId?: string; limit?: number } = {}): Promise<AnalyzeRun> {
  const admin = createAdminClient();
  const { data: jobs, error } = await admin.rpc("claim_jobs", {
    p_kind: "analyze",
    p_limit: options.jobId ? 1 : (options.limit ?? 2),
    p_job_id: options.jobId,
  });
  if (error) throw error;

  const run: AnalyzeRun = { processed: 0, done: 0, failed: 0 };
  for (const job of jobs ?? []) {
    run.processed++;
    // The table constraint guarantees a round for analysis jobs.
    if (job.round_id && (await processJob(admin, job.id, job.round_id, job.attempts))) run.done++;
    else run.failed++;
  }
  return run;
}

async function processJob(admin: ReturnType<typeof createAdminClient>, jobId: string, roundId: string, attempts: number) {
  const fail = async (message: string) => {
    await admin.from("analysis_jobs").update({ status: "failed", error: message, locked_at: null }).eq("id", jobId);
    return false;
  };

  const { data: round } = await admin.from("rounds").select("question, context").eq("id", roundId).single();
  // Data minimisation: pseudonyms and texts only. No names, no emails, no user ids.
  const { data: responses } = await admin
    .from("responses")
    .select("pseudonym, body")
    .eq("round_id", roundId)
    .order("pseudonym");
  if (!round || !responses || responses.length === 0) return fail("Für diese Runde gibt es keine Antworten.");

  try {
    const result = await buildPerspectiveMap({
      question: round.question,
      context: round.context,
      responses: responses.map((r) => ({ id: r.pseudonym, text: r.body })),
    });
    const { error } = await admin.from("analyses").upsert(
      {
        round_id: roundId,
        job_id: jobId,
        map: result.map,
        provider: result.provider,
        model: result.model,
        prompt_version: result.promptVersion,
        response_count: result.responseCount,
        covered_count: result.coveredByModel,
        duration_ms: result.ms,
      },
      { onConflict: "round_id" },
    );
    if (error) throw error;
    await admin
      .from("analysis_jobs")
      .update({
        status: "done",
        // Raw output and failed providers make an empty or odd map traceable (pseudonyms only, no names).
        result: {
          provider: result.provider,
          model: result.model,
          ms: result.ms,
          coveredByModel: result.coveredByModel,
          failures: result.failures,
          raw: result.raw as Json,
        },
        locked_at: null,
      })
      .eq("id", jobId);
    return true;
  } catch (error) {
    console.error("analysis failed", { jobId, attempts, error: String(error) });
    const retriable = !(error instanceof LlmError) || error.retriable;
    return fail(
      retriable && attempts < MAX_ATTEMPTS
        ? "AsyncMeet ist gerade ausgelastet. Versuch es gleich noch einmal."
        : "Die Perspektivenkarte konnte nicht erstellt werden. Die Antworten stehen unten im Original.",
    );
  }
}
