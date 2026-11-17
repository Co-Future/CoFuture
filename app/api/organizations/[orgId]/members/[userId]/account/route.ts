import { apiError, requireUserId } from "@/lib/api/respond";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { isManagedAccount } from "@/lib/organizations/invite-token";
import { uuidSchema } from "@/lib/validation/team";

/**
 * DELETE /api/organizations/{orgId}/members/{userId}/account → 204.
 * Only owners, only for accounts the organization created and that belong to no other organization.
 * Deletes the account with everything that belongs to it (also its answers).
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/organizations/[orgId]/members/[userId]/account">) {
  const { orgId, userId } = await ctx.params;
  if (!uuidSchema.safeParse(orgId).success || !uuidSchema.safeParse(userId).success) {
    return apiError(404, "not_found", "Die Person gibt es hier nicht.");
  }

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;
  if (userId === auth.userId) return apiError(409, "self", "Du kannst dein eigenes Konto nicht hier löschen.");

  const { data: isOwner } = await supabase.rpc("is_org_admin", { p_org_id: orgId });
  if (!isOwner) return apiError(403, "forbidden", "Nur Owner können Konten löschen.");

  const admin = createAdminClient();
  if (!(await isManagedAccount(admin, orgId, userId))) {
    return apiError(403, "not_managed", "Löschen kannst du nur Konten, die deine Organisation angelegt hat. Andere kannst du entfernen.");
  }

  // First through the normal removal, so teams that lose their only lead get a new one.
  const { error: removeError } = await supabase.rpc("remove_organization_member", { p_org_id: orgId, p_user_id: userId });
  if (removeError?.hint === "last_owner") return apiError(409, "last_owner", "Die Organisation braucht mindestens einen Owner.");
  if (removeError) return apiError(500, "delete_failed", "Das Konto konnte nicht gelöscht werden.");

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return apiError(500, "delete_failed", "Das Konto konnte nicht gelöscht werden.");
  return new Response(null, { status: 204 });
}
