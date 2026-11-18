import { randomBytes } from "node:crypto";
import { z } from "zod";
import { apiError, requireUserId } from "@/lib/api/respond";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { isManagedAccount, issueAccessLink } from "@/lib/organizations/invite-token";
import { uuidSchema } from "@/lib/validation/team";

const bodySchema = z.object({ resetPassword: z.boolean().optional() }).optional();

/**
 * POST /api/organizations/{orgId}/members/{userId}/link { resetPassword? } → 201 { link }.
 * Only owners, only for accounts the organization manages (created by it, in no other organization).
 * Issues a new one-time access link and invalidates older ones.
 * With resetPassword the current password stops
 * working, so the person has to set a new one through the link.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/organizations/[orgId]/members/[userId]/link">) {
  const { orgId, userId } = await ctx.params;
  if (!uuidSchema.safeParse(orgId).success || !uuidSchema.safeParse(userId).success) {
    return apiError(404, "not_found", "Die Person gibt es hier nicht.");
  }

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const raw = await request.json().catch(() => undefined);
  const body = bodySchema.safeParse(raw);
  if (!body.success) return apiError(400, "validation_failed", "Bitte prüf deine Eingaben.");
  const resetPassword = body.data?.resetPassword === true;

  const { data: isOwner } = await supabase.rpc("is_org_admin", { p_org_id: orgId });
  if (!isOwner) return apiError(403, "forbidden", "Nur Owner der Organisation können Zugangslinks erzeugen.");

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return apiError(404, "not_found", "Die Person gibt es hier nicht.");

  // A link sets the password of the account. Only for accounts this organization created and that
  // belong to no other organization. Everyone else (self-registered, joined by invitation) signs in
  // with their own password, so no owner can take over their account.
  if (!(await isManagedAccount(admin, orgId, userId))) {
    return apiError(
      403,
      "not_managed",
      "Zugangslinks gibt es nur für Konten, die deine Organisation angelegt hat. Diese Person meldet sich mit dem eigenen Passwort an.",
    );
  }
  if (resetPassword) {
    if (userId === auth.userId) return apiError(409, "self", "Dein eigenes Passwort änderst du nicht hier.");
    const { error } = await admin.auth.admin.updateUserById(userId, { password: randomBytes(32).toString("base64url") });
    if (error) return apiError(500, "reset_failed", "Das Passwort konnte nicht zurückgesetzt werden.");
  }

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
