import { apiError, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/team";

/** DELETE /api/invitations/{invitationId} → 204. The invited person declines. Nothing else changes. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/invitations/[invitationId]">) {
  const { invitationId } = await ctx.params;
  if (!uuidSchema.safeParse(invitationId).success) return notFound();

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  // Only your own invitations here; owners withdraw through /api/organizations/{orgId}/invitations/{id}.
  const { data: own } = await supabase
    .from("organization_invitations")
    .select("id")
    .eq("id", invitationId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!own) return notFound();

  const { error } = await supabase.rpc("delete_organization_invitation", { p_invitation_id: invitationId });
  if (error?.code === "P0002") return notFound();
  if (error) return apiError(500, "decline_failed", "Die Einladung konnte nicht abgelehnt werden.");
  return new Response(null, { status: 204 });
}

function notFound() {
  return apiError(404, "not_found", "Diese Einladung gibt es nicht mehr.");
}
