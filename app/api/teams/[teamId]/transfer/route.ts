import { z } from "zod";
import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/team";

const schema = z.object({ userId: z.uuid("Wähl eine Person aus.") });

/** POST /api/teams/{teamId}/transfer { userId } → 200. The person becomes lead, the caller member. */
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[teamId]/transfer">) {
  const { teamId } = await ctx.params;
  if (!uuidSchema.safeParse(teamId).success) return apiError(404, "not_found", "Das Team gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, schema);
  if ("response" in body) return body.response;

  const { error } = await supabase.rpc("transfer_team", { p_team_id: teamId, p_user_id: body.data.userId });
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur die Teamleitung oder Owner können das Team übergeben.");
  if (error?.code === "P0002") return apiError(404, "not_found", "Das Team gibt es nicht.");
  if (error?.hint === "self") return apiError(409, "self", "Wähl eine andere Person aus.");
  if (error?.hint === "not_eligible") {
    return apiError(409, "not_eligible", "Die neue Leitung muss Owner oder Mitglied der Organisation sein, kein Gast.");
  }
  if (error) return apiError(500, "transfer_failed", "Das Team konnte nicht übergeben werden.");
  return Response.json({ status: "transferred" });
}
