import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { createRoundSchema } from "@/lib/validation/round";
import { uuidSchema } from "@/lib/validation/team";

/**
 * POST /api/teams/{teamId}/rounds { question, context?, deadline, parentRoundId? } → 201 { id }.
 * Team members except guests. With parentRoundId it is a follow-up round of a closed round in the same team.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[teamId]/rounds">) {
  const { teamId } = await ctx.params;
  if (!uuidSchema.safeParse(teamId).success) return apiError(404, "not_found", "Das Team gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, createRoundSchema);
  if ("response" in body) return body.response;

  const { data, error } = await supabase
    .from("rounds")
    .insert({
      team_id: teamId,
      question: body.data.question,
      context: body.data.context,
      deadline: body.data.deadline,
      parent_round_id: body.data.parentRoundId,
    })
    .select("id")
    .single();

  if (error?.hint === "invalid_parent") return apiError(400, "invalid_parent", "Die Ursprungsrunde gehört nicht zu diesem Team.");
  if (error?.hint === "parent_open") return apiError(409, "parent_open", "Die Ursprungsrunde läuft noch. Warte, bis sie geschlossen ist.");
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur Mitglieder des Teams können Runden starten.");
  if (error || !data) return apiError(500, "create_failed", "Die Runde konnte nicht gestartet werden.");
  return Response.json({ id: data.id }, { status: 201 });
}
