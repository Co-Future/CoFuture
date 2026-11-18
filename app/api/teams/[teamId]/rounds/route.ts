import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { createExchangeSchema } from "@/lib/validation/round";
import { uuidSchema } from "@/lib/validation/team";

/**
 * POST /api/teams/{teamId}/rounds { questions: [{ body, targets? }], deadline?, context?, parentRoundId? } → 201 { id }.
 * Starts an exchange with its questions in one step. Team members except guests.
 * Targets are user ids of team members; none means the question goes to everyone.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[teamId]/rounds">) {
  const { teamId } = await ctx.params;
  if (!uuidSchema.safeParse(teamId).success) return apiError(404, "not_found", "Das Team gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, createExchangeSchema);
  if ("response" in body) return body.response;

  const { data, error } = await supabase.rpc("create_exchange", {
    p_team_id: teamId,
    p_questions: body.data.questions.map((q) => ({ body: q.body, targets: q.targets, asks_starter: q.asksStarter })),
    p_deadline: body.data.deadline,
    p_context: body.data.context,
    p_parent_round_id: body.data.parentRoundId,
  });

  if (error?.hint === "invalid_parent") return apiError(400, "invalid_parent", "Der Ursprungs-Austausch gehört nicht zu diesem Team.");
  if (error?.hint === "parent_open") return apiError(409, "parent_open", "Der Ursprungs-Austausch läuft noch. Warte, bis er geschlossen ist.");
  if (error?.hint === "invalid_target") return apiError(400, "invalid_target", "Fragen können nur an Personen aus dem Team gehen.");
  if (error?.hint === "invalid_deadline") return apiError(400, "invalid_deadline", "Die Frist muss in der Zukunft liegen.");
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur Mitglieder des Teams können einen Austausch starten.");
  if (error || !data) return apiError(500, "create_failed", "Der Austausch konnte nicht gestartet werden.");
  return Response.json({ id: data }, { status: 201 });
}
