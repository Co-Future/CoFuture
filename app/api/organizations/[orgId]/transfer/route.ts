import { z } from "zod";
import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/team";

const schema = z.object({ userId: z.uuid("Wähl eine Person aus.") });

/** POST /api/organizations/{orgId}/transfer { userId } → 200. The person becomes owner, the caller member. */
export async function POST(request: Request, ctx: RouteContext<"/api/organizations/[orgId]/transfer">) {
  const { orgId } = await ctx.params;
  if (!uuidSchema.safeParse(orgId).success) return apiError(404, "not_found", "Die Organisation gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, schema);
  if ("response" in body) return body.response;

  const { error } = await supabase.rpc("transfer_organization", { p_org_id: orgId, p_user_id: body.data.userId });
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur Owner können die Organisation übergeben.");
  if (error?.code === "P0002") return apiError(404, "not_found", "Die Person ist nicht in der Organisation.");
  if (error?.hint === "self") return apiError(409, "self", "Wähl eine andere Person aus.");
  if (error) return apiError(500, "transfer_failed", "Die Organisation konnte nicht übergeben werden.");
  return Response.json({ status: "transferred" });
}
