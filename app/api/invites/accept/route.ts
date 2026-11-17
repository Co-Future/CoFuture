import { apiError, readJson } from "@/lib/api/respond";
import { createAdminClient } from "@/lib/db/admin";
import { findValidInvite } from "@/lib/organizations/invite-token";
import { acceptInviteSchema } from "@/lib/validation/organization";

/**
 * POST /api/invites/accept { token, password } → 200 { email }.
 * No session needed: the one-time token proves who you are. Sets the password and uses up the link.
 * The browser then signs in with email and the new password.
 */
export async function POST(request: Request) {
  const body = await readJson(request, acceptInviteSchema);
  if ("response" in body) return body.response;

  const admin = createAdminClient();
  const invite = await findValidInvite(admin, body.data.token);
  if (!invite) {
    return apiError(410, "invite_invalid", "Dieser Zugangslink ist abgelaufen oder wurde schon benutzt. Frag nach einem neuen.");
  }

  // Use up the link first, so a second request with the same token cannot win the race.
  const { data: used } = await admin
    .from("invites")
    .update({ used_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("used_at", null)
    .select("id");
  if (!used || used.length === 0) {
    return apiError(410, "invite_invalid", "Dieser Zugangslink ist abgelaufen oder wurde schon benutzt. Frag nach einem neuen.");
  }

  const { error } = await admin.auth.admin.updateUserById(invite.userId, { password: body.data.password });
  if (error) {
    await admin.from("invites").update({ used_at: null }).eq("id", invite.id);
    if (error.code === "weak_password") {
      return apiError(400, "validation_failed", "Bitte prüf deine Eingaben.", { password: "Das Passwort ist zu schwach. Wähle ein längeres." });
    }
    return apiError(500, "accept_failed", "Das Passwort konnte nicht gespeichert werden.");
  }

  return Response.json({ email: invite.email });
}
