import { cookies } from "next/headers";
import { apiError, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { ORG_COOKIE } from "@/lib/organizations/current";
import { uuidSchema } from "@/lib/validation/team";

/**
 * DELETE /api/organizations/{orgId} → 204. Only owners, and only once nobody else is in it.
 * Deletes its teams, rounds and answers as well.
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/organizations/[orgId]">) {
  const { orgId } = await ctx.params;
  if (!uuidSchema.safeParse(orgId).success) return apiError(404, "not_found", "Die Organisation gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const { error } = await supabase.rpc("delete_organization", { p_org_id: orgId });
  if (error?.code === "42501") return apiError(403, "forbidden", "Nur Owner können die Organisation löschen.");
  if (error?.hint === "not_empty") {
    return apiError(409, "not_empty", "Entferne zuerst alle anderen Personen aus der Organisation.");
  }
  if (error) return apiError(500, "delete_failed", "Die Organisation konnte nicht gelöscht werden.");

  const cookieStore = await cookies();
  if (cookieStore.get(ORG_COOKIE)?.value === orgId) cookieStore.delete(ORG_COOKIE);
  return new Response(null, { status: 204 });
}
