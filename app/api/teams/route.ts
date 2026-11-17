import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { createTeamSchema } from "@/lib/validation/team";

/** POST /api/teams { name } → 201 { id, name }. The caller becomes the team's lead. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, createTeamSchema);
  if ("response" in body) return body.response;

  const { data, error } = await supabase.rpc("create_team", { p_name: body.data.name });
  if (error || !data) return apiError(500, "create_failed", "Das Team konnte nicht angelegt werden.");

  return Response.json({ id: data.id, name: data.name }, { status: 201 });
}
