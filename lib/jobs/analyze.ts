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
  const [{ data: questions }, { data: answers }] = await Promise.all([
    admin.from("round_questions").select("id, body").eq("round_id", roundId).order("position"),
    admin
      .from("response_answers")
      .select("question_id, body, responses!inner(pseudonym, round_id)")
      .eq("responses.round_id", roundId),
  ]);
  if (!round || !questions || !answers || answers.length === 0) return fail("Für diesen Austausch gibt es keine Antworten.");

  try {
    // One map per question; stored as one flat list with question_id, so decisions keep their cluster indexes.
    const inputs = questions
      .map((q) => ({
        question: q,
        responses: answers
          .filter((a) => a.question_id === q.id)
          .map((a) => ({ id: a.responses.pseudonym, text: a.body }))
          .sort((x, y) => x.id.localeCompare(y.id)),
      }))
      .filter((i) => i.responses.length > 0);
    const results = await Promise.all(
      inputs.map((i) => buildPerspectiveMap({ question: i.question.body, context: round.context, responses: i.responses })),
    );
    const map = {
      clusters: results.flatMap((r, i) => r.map.clusters.map((c) => ({ ...c, question_id: inputs[i].question.id }))),
      open_questions: results.flatMap((r, i) => r.map.open_questions.map((q) => ({ ...q, question_id: inputs[i].question.id }))),
    };
    const result = {
      provider: results[0].provider,
      model: results[0].model,
      promptVersion: results[0].promptVersion,
      ms: results.reduce((sum, r) => sum + r.ms, 0),
      // Counted per answer to a question (one person answering three questions counts three times).
      responseCount: results.reduce((sum, r) => sum + r.responseCount, 0),
      coveredByModel: results.reduce((sum, r) => sum + r.coveredByModel, 0),
      failures: results.flatMap((r) => r.failures),
      raw: results.map((r, i) => ({ question_id: inputs[i].question.id, raw: r.raw })),
    };
    const { error } = await admin.from("analyses").upsert(
      {
        round_id: roundId,
        job_id: jobId,
        map,
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
