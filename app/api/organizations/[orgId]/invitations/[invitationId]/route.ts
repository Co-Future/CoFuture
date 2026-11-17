import { apiError, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/team";

/** DELETE /api/organizations/{orgId}/invitations/{invitationId} → 204. Owners withdraw an open invitation. */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/organizations/[orgId]/invitations/[invitationId]">,
) {
  const { orgId, invitationId } = await ctx.params;
  if (!uuidSchema.safeParse(orgId).success || !uuidSchema.safeParse(invitationId).success) return notFound();

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const { data: isOwner } = await supabase.rpc("is_org_admin", { p_org_id: orgId });
  if (!isOwner) return apiError(403, "forbidden", "Nur Owner der Organisation können Einladungen zurückziehen.");

  const { data: invitation } = await supabase
    .from("organization_invitations")
    .select("id")
    .eq("id", invitationId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!invitation) return notFound();

  const { error } = await supabase.rpc("delete_organization_invitation", { p_invitation_id: invitationId });
  if (error?.code === "P0002") return notFound();
  if (error) return apiError(500, "withdraw_failed", "Die Einladung konnte nicht zurückgezogen werden.");
  return new Response(null, { status: 204 });
}

function notFound() {
  return apiError(404, "not_found", "Diese Einladung gibt es nicht mehr.");
}
