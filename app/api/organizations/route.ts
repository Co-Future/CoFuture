import { cookies } from "next/headers";
import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { ORG_COOKIE, orgCookieOptions } from "@/lib/organizations/current";
import { createOrganizationSchema } from "@/lib/validation/organization";

/** POST /api/organizations { name } → 201 { id, name }. The caller becomes its admin; the app switches to it. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, createOrganizationSchema);
  if ("response" in body) return body.response;

  const { data, error } = await supabase.rpc("create_organization", { p_name: body.data.name });
  if (error || !data) return apiError(500, "create_failed", "Die Organisation konnte nicht angelegt werden.");

  (await cookies()).set(ORG_COOKIE, data.id, orgCookieOptions);
  return Response.json({ id: data.id, name: data.name }, { status: 201 });
}
