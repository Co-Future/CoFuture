import { after } from "next/server";
import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { runTranscribeJobs } from "@/lib/jobs/transcribe";
import { uuidSchema } from "@/lib/validation/team";
import { questionsVoiceJobSchema } from "@/lib/validation/voice";

export const maxDuration = 300;

/**
 * POST /api/teams/{teamId}/voice { path, mime, durationMs } → 202 { jobId }.
 * Dictated question for a new round: the browser has already uploaded the audio to the private bucket.
 * The job transcribes it and AsyncMeet suggests question and context (result.draft). Members, no guests.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[teamId]/voice">) {
  const { teamId } = await ctx.params;
  if (!uuidSchema.safeParse(teamId).success) return apiError(404, "not_found", "Das Team gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, questionsVoiceJobSchema);
  if ("response" in body) return body.response;
  if (!body.data.path.startsWith(`${auth.userId}/`)) return apiError(403, "forbidden", "Das ist nicht deine Aufnahme.");

  const { data: job, error } = await supabase
    .from("analysis_jobs")
    .insert({
      kind: "transcribe",
      team_id: teamId,
      payload: { path: body.data.path, mime: body.data.mime, durationMs: body.data.durationMs, mode: body.data.mode, questions: body.data.questions },
    })
    .select("id")
    .single();
  if (error?.code === "42501") return apiError(403, "forbidden", "Runden starten können nur Mitglieder des Teams.");
  if (error || !job) return apiError(500, "queue_failed", "Die Aufnahme konnte nicht verarbeitet werden.");

  after(() => runTranscribeJobs({ jobId: job.id }).catch((e) => console.error("worker after()", e)));
  return Response.json({ jobId: job.id }, { status: 202 });
}
