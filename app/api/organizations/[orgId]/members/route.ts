import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { issueAccessLink } from "@/lib/organizations/invite-token";
import { addPersonSchema } from "@/lib/validation/organization";
import { uuidSchema } from "@/lib/validation/team";

/**
 * POST /api/organizations/{orgId}/members { displayName, email, teamId? } → 201 { userId, link }.
 * Only admins. Creates the account without a password and returns a one-time access link,
 * with which the person sets their own password. If the email already has an account, the
 * person simply joins (link is null: they sign in as usual).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/organizations/[orgId]/members">) {
  const { orgId } = await ctx.params;
  if (!uuidSchema.safeParse(orgId).success) return apiError(404, "not_found", "Die Organisation gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, addPersonSchema);
  if ("response" in body) return body.response;
  const { displayName, email, teamId } = body.data;

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId });
  if (!isAdmin) return apiError(403, "forbidden", "Nur Admins der Organisation können Personen hinzufügen.");

  const admin = createAdminClient();
  if (teamId) {
    const { data: team } = await admin.from("teams").select("id").eq("id", teamId).eq("organization_id", orgId).maybeSingle();
    if (!team) return apiError(400, "validation_failed", "Bitte prüf deine Eingaben.", { teamId: "Dieses Team gibt es hier nicht." });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError?.code === "email_exists" || createError?.code === "user_already_exists") {
    return addExistingAccount(admin, { orgId, email, teamId });
  }
  if (createError || !created.user) return apiError(500, "create_failed", "Die Person konnte nicht angelegt werden.");
  const userId = created.user.id;

  try {
    const { error: memberError } = await admin
      .from("organization_members")
      .insert({ organization_id: orgId, user_id: userId, role: "member" });
    if (memberError) throw memberError;
    if (teamId) {
      const { error: teamError } = await admin.from("team_members").insert({ team_id: teamId, user_id: userId, role: "member" });
      if (teamError) throw teamError;
    }
    const link = await issueAccessLink(admin, {
      organizationId: orgId,
      userId,
      createdBy: auth.userId,
      origin: new URL(request.url).origin,
    });
    return Response.json({ userId, link }, { status: 201 });
  } catch {
    // Roll back the half-created person so the admin can simply try again.
    await admin.auth.admin.deleteUser(userId);
    return apiError(500, "create_failed", "Die Person konnte nicht angelegt werden.");
  }
}

/** The email already has an account: add that person to the organization (and team) without a link. */
async function addExistingAccount(
  admin: ReturnType<typeof createAdminClient>,
  { orgId, email, teamId }: { orgId: string; email: string; teamId?: string },
) {
  const { data: userId } = await admin.rpc("find_user_id_by_email", { p_email: email });
  if (!userId) return apiError(500, "create_failed", "Die Person konnte nicht angelegt werden.");

  const { error } = await admin.from("organization_members").insert({ organization_id: orgId, user_id: userId, role: "member" });
  if (error?.code === "23505") {
    return apiError(409, "already_member", "Diese Person ist schon in der Organisation.", {
      email: "Diese Person ist schon in der Organisation.",
    });
  }
  if (error) return apiError(500, "create_failed", "Die Person konnte nicht hinzugefügt werden.");
  if (teamId) {
    await admin.from("team_members").upsert({ team_id: teamId, user_id: userId, role: "member" }, { ignoreDuplicates: true });
  }
  return Response.json({ userId, link: null }, { status: 201 });
}
