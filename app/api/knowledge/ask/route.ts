import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { askKnowledge } from "@/lib/knowledge/search";
import { getCurrentOrganization } from "@/lib/organizations/current";
import { knowledgeQuestionSchema } from "@/lib/validation/knowledge";

export const maxDuration = 60;

/**
 * POST /api/knowledge/ask { question, team? } → 200 { statements, consulted, mode, model, promptVersion }.
 * AsyncMeet answers only from what you may see in the knowledge store; every statement has sources.
 * Empty statements: nothing reliable in the store. A short, interactive call (ADR 013), not a job.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, knowledgeQuestionSchema);
  if ("response" in body) return body.response;

  const org = await getCurrentOrganization(auth.userId);
  if (!org) return apiError(404, "no_organization", "Du bist in keiner Organisation.");

  try {
    const answer = await askKnowledge(supabase, { organizationId: org.id, question: body.data.question, teamId: body.data.team });
    return Response.json(answer);
  } catch (error) {
    console.error("knowledge answer failed", String(error));
    return apiError(
      503,
      "answer_failed",
      "AsyncMeet ist gerade ausgelastet. Die Suche funktioniert weiter, versuch die Frage gleich noch einmal.",
    );
  }
}
