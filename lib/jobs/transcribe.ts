import { draftQuestion, type QuestionDraft } from "@/lib/ai/question-draft";
import { createAdminClient } from "@/lib/db/admin";
import type { Database } from "@/lib/db/types";
import { configuredProviders, SttError, transcribe, transcriptionHint } from "@/lib/stt";

type Job = Database["public"]["Tables"]["analysis_jobs"]["Row"];
type Payload = { path: string; mime: string };

const MAX_ATTEMPTS = 3;
const AUDIO_TTL_MS = 24 * 60 * 60 * 1000;

export type TranscribeRun = { processed: number; done: number; failed: number };

/**
 * Claims runnable transcription jobs and processes them: download audio, transcribe, store the
 * text in the job, delete the audio. A specific job id processes just that one job.
 */
export async function runTranscribeJobs(options: { jobId?: string; limit?: number } = {}): Promise<TranscribeRun> {
  const admin = createAdminClient();
  const { data: jobs, error } = await admin.rpc("claim_jobs", {
    p_kind: "transcribe",
    p_limit: options.jobId ? 1 : (options.limit ?? 5),
    p_job_id: options.jobId,
  });
  if (error) throw error;

  const run: TranscribeRun = { processed: 0, done: 0, failed: 0 };
  for (const job of jobs ?? []) {
    run.processed++;
    if (await processJob(admin, job)) run.done++;
    else run.failed++;
  }
  return run;
}

async function processJob(admin: ReturnType<typeof createAdminClient>, job: Job): Promise<boolean> {
  const { path, mime } = job.payload as Payload;
  const finalAttempt = job.attempts >= MAX_ATTEMPTS;

  const fail = async (message: string, deleteAudio: boolean) => {
    await admin.from("analysis_jobs").update({ status: "failed", error: message, locked_at: null }).eq("id", job.id);
    if (deleteAudio) await admin.storage.from("voice").remove([path]);
    return false;
  };

  const { data: audio, error: downloadError } = await admin.storage.from("voice").download(path);
  if (downloadError || !audio) return fail("Die Aufnahme wurde nicht gefunden. Nimm sie bitte neu auf.", false);

  const { data: round } = job.round_id
    ? await admin.from("rounds").select("question, context").eq("id", job.round_id).maybeSingle()
    : { data: null };
  const hint = round ? transcriptionHint(round.question, round.context) : undefined;

  try {
    const transcript = await transcribe(audio, mime, configuredProviders(), hint);
    if (!transcript.text) return fail("In der Aufnahme wurde keine Sprache erkannt. Nimm sie bitte neu auf.", true);

    // A dictated question (job of a team, no round yet): AsyncMeet suggests question and context.
    // If that fails, the person still gets the plain transcript.
    let draft: QuestionDraft | null = null;
    if (!job.round_id) {
      draft = await draftQuestion(transcript.text).catch((error) => {
        console.warn("question draft failed", { jobId: job.id, error: String(error).slice(0, 300) });
        return null;
      });
    }

    await admin
      .from("analysis_jobs")
      .update({ status: "done", result: { ...transcript, draft }, error: null, locked_at: null })
      .eq("id", job.id);
    // Data minimisation: the audio is gone as soon as we have the text.
    await admin.storage.from("voice").remove([path]);
    return true;
  } catch (error) {
    console.error("transcription failed", { jobId: job.id, attempt: job.attempts, error: String(error) });
    const retriable = !(error instanceof SttError) || error.retriable;
    const message =
      retriable && !finalAttempt
        ? "Die Transkription ist gerade nicht erreichbar. Versuch es gleich noch einmal."
        : "Die Aufnahme konnte nicht transkribiert werden. Nimm sie bitte neu auf oder antworte als Text.";
    return fail(message, finalAttempt || !retriable);
  }
}

/** Deletes audio files older than 24 hours, e.g. from uploads whose job was never created. */
export async function sweepOldAudio(now = Date.now()): Promise<number> {
  const admin = createAdminClient();
  const bucket = admin.storage.from("voice");
  const { data: folders } = await bucket.list("", { limit: 1000 });
  const stale: string[] = [];
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(folder.name, { limit: 1000 });
    for (const file of files ?? []) {
      const created = Date.parse(file.created_at ?? "");
      if (Number.isFinite(created) && now - created > AUDIO_TTL_MS) stale.push(`${folder.name}/${file.name}`);
    }
  }
  if (stale.length > 0) await bucket.remove(stale);
  return stale.length;
}
