import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { setRoleSchema } from "@/lib/validation/organization";
import { uuidSchema } from "@/lib/validation/team";

function parseIds(orgId: string, userId: string) {
  return uuidSchema.safeParse(orgId).success && uuidSchema.safeParse(userId).success;
}

/** PATCH /api/organizations/{orgId}/members/{userId} { role } → 200 { role }. Only owners; one owner always remains. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/organizations/[orgId]/members/[userId]">) {
  const { orgId, userId } = await ctx.params;
  if (!parseIds(orgId, userId)) return apiError(404, "not_found", "Die Person gibt es hier nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, setRoleSchema);
  if ("response" in body) return body.response;

  const { error } = await supabase.rpc("set_organization_role", { p_org_id: orgId, p_user_id: userId, p_role: body.data.role });
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur Owner können Rollen ändern.");
  if (error?.code === "P0002") return apiError(404, "not_found", "Die Person gibt es hier nicht.");
  if (error?.hint === "last_owner") return apiError(409, "last_owner", "Die Organisation braucht mindestens einen Owner.");
  if (error) return apiError(500, "update_failed", "Die Rolle konnte nicht geändert werden.");

  return Response.json({ role: body.data.role });
}

/** DELETE /api/organizations/{orgId}/members/{userId} → 204. Only owners; removes the person from all teams of the organization. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/organizations/[orgId]/members/[userId]">) {
  const { orgId, userId } = await ctx.params;
  if (!parseIds(orgId, userId)) return apiError(404, "not_found", "Die Person gibt es hier nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const { error } = await supabase.rpc("remove_organization_member", { p_org_id: orgId, p_user_id: userId });
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur Owner können Personen entfernen.");
  if (error?.hint === "last_owner") return apiError(409, "last_owner", "Die Organisation braucht mindestens einen Owner.");
  if (error?.hint === "self") return apiError(409, "self", "Du kannst dich nicht selbst entfernen.");
  if (error) return apiError(500, "remove_failed", "Die Person konnte nicht entfernt werden.");

  return new Response(null, { status: 204 });
}
