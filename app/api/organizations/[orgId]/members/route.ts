import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { issueAccessLink } from "@/lib/organizations/invite-token";
import type { OrgRole } from "@/lib/organizations/roles";
import { addPersonSchema, type AddPersonResult } from "@/lib/validation/organization";
import { uuidSchema } from "@/lib/validation/team";

/**
 * POST /api/organizations/{orgId}/members { displayName, email, role?, teamIds? } → 201. Only owners.
 * - No account yet: creates it (managed by the organization), adds it with role and teams and
 *   returns a one-time access link → { status: "created", userId, link }.
 * - Account exists: nobody joins yet. An invitation is created that the person accepts or declines
 *   after signing in → { status: "invited" }.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/organizations/[orgId]/members">) {
  const { orgId } = await ctx.params;
  if (!uuidSchema.safeParse(orgId).success) return apiError(404, "not_found", "Die Organisation gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, addPersonSchema);
  if ("response" in body) return body.response;
  const { displayName, email, teamIds, role } = body.data;

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId });
  if (!isAdmin) return apiError(403, "forbidden", "Nur Owner der Organisation können Personen hinzufügen.");

  const admin = createAdminClient();
  if (teamIds.length > 0) {
    const { data: teams } = await admin.from("teams").select("id").in("id", teamIds).eq("organization_id", orgId);
    if ((teams ?? []).length !== teamIds.length) return invalidTeam();
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError?.code === "email_exists" || createError?.code === "user_already_exists") {
    return inviteExistingAccount(supabase, { orgId, email, teamIds, role });
  }
  if (createError || !created.user) return apiError(500, "create_failed", "Die Person konnte nicht angelegt werden.");
  const userId = created.user.id;

  try {
    const { error: memberError } = await admin
      .from("organization_members")
      .insert({ organization_id: orgId, user_id: userId, role, managed: true });
    if (memberError) throw memberError;
    if (teamIds.length > 0) {
      const { error: teamError } = await admin
        .from("team_members")
        .insert(teamIds.map((teamId) => ({ team_id: teamId, user_id: userId, role: "member" as const })));
      if (teamError) throw teamError;
    }
    const link = await issueAccessLink(admin, {
      organizationId: orgId,
      userId,
      createdBy: auth.userId,
      origin: new URL(request.url).origin,
    });
    return Response.json({ status: "created", userId, link } satisfies AddPersonResult, { status: 201 });
  } catch {
    // Roll back the half-created person so the owner can simply try again.
    await admin.auth.admin.deleteUser(userId);
    return apiError(500, "create_failed", "Die Person konnte nicht angelegt werden.");
  }
}

function invalidTeam() {
  return apiError(400, "validation_failed", "Bitte prüf deine Eingaben.", { teamIds: "Eines der Teams gibt es hier nicht." });
}

/**
 * The email already has an account: create an invitation as the signed-in owner. The database
 * checks ownership, membership, duplicates and teams (invite_to_organization).
 */
async function inviteExistingAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { orgId, email, teamIds, role }: { orgId: string; email: string; teamIds: string[]; role: OrgRole },
) {
  const { data, error } = await supabase.rpc("invite_to_organization", {
    p_org_id: orgId,
    p_email: email,
    p_role: role,
    p_team_ids: teamIds,
  });
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur Owner der Organisation können Personen hinzufügen.");
  if (error || !data || data === "not_found") {
    return apiError(500, "invite_failed", "Die Einladung konnte nicht erstellt werden.");
  }
  if (data === "already_member") {
    return apiError(409, "already_member", "Diese Person ist schon in der Organisation.", {
      email: "Diese Person ist schon in der Organisation.",
    });
  }
  if (data === "already_invited") {
    return apiError(409, "already_invited", "Diese Person ist schon eingeladen.", {
      email: "Diese Person ist schon eingeladen. Sie sieht die Einladung nach dem Anmelden.",
    });
  }
  if (data === "invalid_team") return invalidTeam();

  return Response.json({ status: "invited" } satisfies AddPersonResult, { status: 201 });
}
