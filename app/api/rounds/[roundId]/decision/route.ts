import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { decisionSchema } from "@/lib/validation/decision";
import { uuidSchema } from "@/lib/validation/team";

/**
 * POST /api/rounds/{roundId}/decision { body, rationale, clusterRefs? } → 201 { id }.
 * Records the decision of a closed round and sets it to "decided". Round creator or team lead, no guests.
 * A person decides; AsyncMeet's map is only referenced (clusterRefs).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/rounds/[roundId]/decision">) {
  const { roundId } = await ctx.params;
  if (!uuidSchema.safeParse(roundId).success) return apiError(404, "not_found", "Die Runde gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, decisionSchema);
  if ("response" in body) return body.response;

  const { data, error } = await supabase.rpc("decide_round", {
    p_round_id: roundId,
    p_body: body.data.body,
    p_rationale: body.data.rationale,
    p_cluster_refs: body.data.clusterRefs,
  });

  if (error?.code === "P0002") return apiError(404, "not_found", "Die Runde gibt es nicht.");
  if (error?.code === "42501") return apiError(403, "forbidden", "Beschließen kann nur, wer die Runde gestartet hat, oder die Teamleitung.");
  if (error?.hint === "round_open") return apiError(409, "round_open", "Die Runde läuft noch. Schließ sie zuerst.");
  if (error?.hint === "already_decided") return apiError(409, "already_decided", "Für diese Runde gibt es schon einen Beschluss.");
  if (error || !data) return apiError(500, "decide_failed", "Der Beschluss konnte nicht gespeichert werden.");
  return Response.json({ id: data.id }, { status: 201 });
}
