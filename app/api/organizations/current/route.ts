import { cookies } from "next/headers";
import { z } from "zod";
import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { ORG_COOKIE, orgCookieOptions } from "@/lib/organizations/current";

const schema = z.object({ organizationId: z.uuid() });

/** POST /api/organizations/current { organizationId } → 204. Switches the organization shown in the app. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, schema);
  if ("response" in body) return body.response;

  const { data: isMember } = await supabase.rpc("is_org_member", { p_org_id: body.data.organizationId });
  if (!isMember) return apiError(404, "not_found", "Diese Organisation gibt es für dich nicht.");

  (await cookies()).set(ORG_COOKIE, body.data.organizationId, orgCookieOptions);
  return new Response(null, { status: 204 });
}
