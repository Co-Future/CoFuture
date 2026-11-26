import { after } from "next/server";
import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { runTranscribeJobs } from "@/lib/jobs/transcribe";
import { uuidSchema } from "@/lib/validation/team";
import { voiceJobSchema } from "@/lib/validation/voice";

export const maxDuration = 300;

/**
 * POST /api/rounds/{roundId}/decision/voice { path, mime, durationMs } → 202 { jobId }.
 * Dictated decision: the job transcribes it and AsyncMeet splits it into decision and rationale
 * (result.structured). Only the round creator or team lead of a closed round (RLS on analysis_jobs).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/rounds/[roundId]/decision/voice">) {
  const { roundId } = await ctx.params;
  if (!uuidSchema.safeParse(roundId).success) return apiError(404, "not_found", "Den Austausch gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, voiceJobSchema);
  if ("response" in body) return body.response;
  if (!body.data.path.startsWith(`${auth.userId}/`)) return apiError(403, "forbidden", "Das ist nicht deine Aufnahme.");

  const { data: job, error } = await supabase
    .from("analysis_jobs")
    .insert({
      kind: "transcribe",
      round_id: roundId,
      payload: { path: body.data.path, mime: body.data.mime, durationMs: body.data.durationMs, purpose: "decision" },
    })
    .select("id")
    .single();
  if (error?.code === "42501") {
    return apiError(
      403,
      "forbidden",
      "Einen Beschluss einsprechen kann nur, wer den Austausch gestartet hat, oder die Teamleitung.",
    );
  }
  if (error || !job) return apiError(500, "queue_failed", "Die Aufnahme konnte nicht verarbeitet werden.");

  after(() => runTranscribeJobs({ jobId: job.id }).catch((e) => console.error("worker after()", e)));
  return Response.json({ jobId: job.id }, { status: 202 });
}
