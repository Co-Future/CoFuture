import { after } from "next/server";
import { apiError, requireUserId } from "@/lib/api/respond";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { runTranscribeJobs } from "@/lib/jobs/transcribe";
import { uuidSchema } from "@/lib/validation/team";

export const maxDuration = 300;

/** POST /api/jobs/{jobId}/retry → 202. Requeues your own failed transcription (max. 3 attempts). */
export async function POST(_request: Request, ctx: RouteContext<"/api/jobs/[jobId]/retry">) {
  const { jobId } = await ctx.params;
  if (!uuidSchema.safeParse(jobId).success) return apiError(404, "not_found", "Den Auftrag gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  // RLS: you only see your own jobs.
  const { data: job } = await supabase.from("analysis_jobs").select("id, status, attempts").eq("id", jobId).maybeSingle();
  if (!job) return apiError(404, "not_found", "Den Auftrag gibt es nicht.");
  if (job.status !== "failed") return apiError(409, "not_failed", "Der Auftrag läuft noch oder ist fertig.");
  if (job.attempts >= 3) return apiError(409, "no_attempts_left", "Keine weiteren Versuche möglich. Nimm die Antwort bitte neu auf.");

  const { error } = await createAdminClient()
    .from("analysis_jobs")
    .update({ status: "pending", error: null })
    .eq("id", jobId)
    .eq("status", "failed");
  if (error) return apiError(500, "retry_failed", "Der neue Versuch konnte nicht gestartet werden.");

  after(() => runTranscribeJobs({ jobId }).catch((e) => console.error("worker after()", e)));
  return Response.json({ status: "pending" }, { status: 202 });
}
