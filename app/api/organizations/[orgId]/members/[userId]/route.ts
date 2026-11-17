import { apiError, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/team";

/** DELETE /api/organizations/{orgId}/members/{userId} → 204. Only admins; removes the person from all teams of the organization. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/organizations/[orgId]/members/[userId]">) {
  const { orgId, userId } = await ctx.params;
  if (!uuidSchema.safeParse(orgId).success || !uuidSchema.safeParse(userId).success) {
    return apiError(404, "not_found", "Die Person gibt es hier nicht.");
  }

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const { error } = await supabase.rpc("remove_organization_member", { p_org_id: orgId, p_user_id: userId });
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur Admins der Organisation können Personen entfernen.");
  if (error?.hint === "last_admin") return apiError(409, "last_admin", "Die Organisation braucht mindestens einen Admin.");
  if (error?.hint === "self") return apiError(409, "self", "Du kannst dich nicht selbst entfernen.");
  if (error) return apiError(500, "remove_failed", "Die Person konnte nicht entfernt werden.");

  return new Response(null, { status: 204 });
}
