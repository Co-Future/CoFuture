import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { addTeamMemberSchema, uuidSchema } from "@/lib/validation/team";

/**
 * POST /api/teams/{teamId}/members { userId } | { email } → 201. Only leads.
 * Teams in an organization take people from that organization only.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[teamId]/members">) {
  const { teamId } = await ctx.params;
  if (!uuidSchema.safeParse(teamId).success) return apiError(404, "not_found", "Das Team gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, addTeamMemberSchema);
  if ("response" in body) return body.response;

  const { data, error } =
    "userId" in body.data
      ? await supabase.rpc("add_team_member", { p_team_id: teamId, p_user_id: body.data.userId })
      : await supabase.rpc("add_team_member_by_email", { p_team_id: teamId, p_email: body.data.email });
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur die Teamleitung kann Mitglieder hinzufügen.");
  if (error) return apiError(500, "add_failed", "Das Mitglied konnte nicht hinzugefügt werden.");

  if (data === "not_found") {
    return apiError(404, "user_not_found", "Diese Person gibt es nicht oder sie gehört nicht zu deiner Organisation.");
  }
  if (data === "already_member") return apiError(409, "already_member", "Die Person ist schon im Team.");
  return Response.json({ status: "added" }, { status: 201 });
}
