import { apiError, requireUserId } from "@/lib/api/respond";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { issueAccessLink } from "@/lib/organizations/invite-token";
import { uuidSchema } from "@/lib/validation/team";

/**
 * POST /api/organizations/{orgId}/members/{userId}/link → 201 { link }.
 * Only admins. Issues a new one-time access link and invalidates older ones.
 * Also the way back in after a forgotten password, as long as there is no email delivery.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/organizations/[orgId]/members/[userId]/link">) {
  const { orgId, userId } = await ctx.params;
  if (!uuidSchema.safeParse(orgId).success || !uuidSchema.safeParse(userId).success) {
    return apiError(404, "not_found", "Die Person gibt es hier nicht.");
  }

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId });
  if (!isAdmin) return apiError(403, "forbidden", "Nur Admins der Organisation können Zugangslinks erzeugen.");

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return apiError(404, "not_found", "Die Person gibt es hier nicht.");

  try {
    const link = await issueAccessLink(admin, {
      organizationId: orgId,
      userId,
      createdBy: auth.userId,
      origin: new URL(request.url).origin,
    });
    return Response.json({ link }, { status: 201 });
  } catch {
    return apiError(500, "link_failed", "Der Zugangslink konnte nicht erzeugt werden.");
  }
}
