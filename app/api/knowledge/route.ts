import { apiError, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { searchKnowledge } from "@/lib/knowledge/search";
import { getCurrentOrganization } from "@/lib/organizations/current";
import { fieldErrors } from "@/lib/validation/auth";
import { knowledgeSearchSchema } from "@/lib/validation/knowledge";

/**
 * GET /api/knowledge?q=…&team=… → 200 { mode, hits }.
 * Hybrid search in the knowledge store of your current organization. You only find what you may
 * see in the original (RLS). Without Gemini the search falls back to words only (mode "text").
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = knowledgeSearchSchema.safeParse(params);
  if (!parsed.success) return apiError(400, "invalid_input", "Die Suche ist ungültig.", fieldErrors(parsed.error));

  const org = await getCurrentOrganization(auth.userId);
  if (!org) return apiError(404, "no_organization", "Du bist in keiner Organisation.");

  try {
    const result = await searchKnowledge(supabase, { organizationId: org.id, query: parsed.data.q, teamId: parsed.data.team });
    return Response.json(result);
  } catch (error) {
    console.error("knowledge search failed", String(error));
    return apiError(500, "search_failed", "Die Suche hat nicht geklappt. Versuch es gleich noch einmal.");
  }
}
