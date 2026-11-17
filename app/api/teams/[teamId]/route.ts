import { apiError, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/team";

/**
 * DELETE /api/teams/{teamId} → 204. Team leads or owners of the organization, and only once
 * nobody else is in the team. Deletes its rounds and answers as well.
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/teams/[teamId]">) {
  const { teamId } = await ctx.params;
  if (!uuidSchema.safeParse(teamId).success) return apiError(404, "not_found", "Das Team gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const { error } = await supabase.rpc("delete_team", { p_team_id: teamId });
  if (error?.code === "P0002") return apiError(404, "not_found", "Das Team gibt es nicht.");
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur die Teamleitung oder Owner können das Team löschen.");
  if (error?.hint === "not_empty") return apiError(409, "not_empty", "Entferne zuerst alle anderen Mitglieder aus dem Team.");
  if (error) return apiError(500, "delete_failed", "Das Team konnte nicht gelöscht werden.");

  return new Response(null, { status: 204 });
}
