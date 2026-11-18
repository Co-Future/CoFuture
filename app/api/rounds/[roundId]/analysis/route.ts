import { after } from "next/server";
import { apiError, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { runAnalyzeJobs } from "@/lib/jobs/analyze";
import { uuidSchema } from "@/lib/validation/team";

export const maxDuration = 300;

/**
 * POST /api/rounds/{roundId}/analysis → 200 { status: "done" } | 202 { status, jobId }.
 * The analysis job is created by the database when a round closes (also via pg_cron).
 * Any team member who opens the round can start it; claim_jobs makes sure it runs only once.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/rounds/[roundId]/analysis">) {
  const { roundId } = await ctx.params;
  if (!uuidSchema.safeParse(roundId).success) return apiError(404, "not_found", "Die Runde gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  // RLS: team members see the analysis and the analysis job of their rounds.
  const { data: analysis } = await supabase.rpc("round_analysis", { p_round_id: roundId }).maybeSingle();
  if (analysis) return Response.json({ status: "done" });

  const { data: job } = await supabase
    .from("analysis_jobs")
    .select("id, status")
    .eq("round_id", roundId)
    .eq("kind", "analyze")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job) return apiError(404, "no_analysis", "Für diese Runde gibt es keine Analyse. Sie startet, wenn die Runde mit Antworten endet.");

  if (job.status === "pending" || job.status === "running") {
    // A running job is only claimed again once it is stale (crashed worker).
    after(() => runAnalyzeJobs({ jobId: job.id }).catch((e) => console.error("analyze after()", e)));
  }
  return Response.json({ status: job.status, jobId: job.id }, { status: 202 });
}
