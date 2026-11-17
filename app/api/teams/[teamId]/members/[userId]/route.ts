import { apiError, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/team";

/** DELETE /api/teams/{teamId}/members/{userId} → 204. Leads remove anyone; everyone can leave. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/teams/[teamId]/members/[userId]">) {
  const { teamId, userId } = await ctx.params;
  if (!uuidSchema.safeParse(teamId).success || !uuidSchema.safeParse(userId).success) {
    return apiError(404, "not_found", "Das Mitglied gibt es nicht.");
  }

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const { data, error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .select("user_id");

  if (error?.hint === "last_lead") {
    return apiError(409, "last_lead", "Ein Team braucht mindestens eine Leitung. Ernenne zuerst eine andere Person zur Leitung.");
  }
  if (error) return apiError(500, "remove_failed", "Das Mitglied konnte nicht entfernt werden.");
  // RLS hides rows the caller may not delete, so "nothing deleted" means not allowed or not there.
  if (data.length === 0) return apiError(403, "forbidden", "Das darfst du nicht.");

  return new Response(null, { status: 204 });
}
