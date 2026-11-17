import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { createRoundSchema } from "@/lib/validation/round";
import { uuidSchema } from "@/lib/validation/team";

/** POST /api/teams/{teamId}/rounds { question, context?, deadline } → 201 { id }. Any team member. */
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
    .insert({ team_id: teamId, question: body.data.question, context: body.data.context, deadline: body.data.deadline })
    .select("id")
    .single();

  if (error?.code === "42501") return apiError(403, "forbidden", "Nur Mitglieder des Teams können Runden starten.");
  if (error || !data) return apiError(500, "create_failed", "Die Runde konnte nicht gestartet werden.");
  return Response.json({ id: data.id }, { status: 201 });
}
