import { cookies } from "next/headers";
import { apiError, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { ORG_COOKIE, orgCookieOptions } from "@/lib/organizations/current";
import { uuidSchema } from "@/lib/validation/team";

/**
 * POST /api/invitations/{invitationId}/accept → 200 { organizationId }.
 * The invited person joins the organization with the invited role and teams.
 * The app switches to the new organization.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/invitations/[invitationId]/accept">) {
  const { invitationId } = await ctx.params;
  if (!uuidSchema.safeParse(invitationId).success) return notFound();

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const { data: organizationId, error } = await supabase.rpc("accept_organization_invitation", {
    p_invitation_id: invitationId,
  });
  if (error?.code === "P0002") return notFound();
  if (error || !organizationId) return apiError(500, "accept_failed", "Die Einladung konnte nicht angenommen werden.");

  (await cookies()).set(ORG_COOKIE, organizationId, orgCookieOptions);
  return Response.json({ organizationId });
}

function notFound() {
  return apiError(404, "not_found", "Diese Einladung gibt es nicht mehr. Vielleicht wurde sie zurückgezogen.");
}
