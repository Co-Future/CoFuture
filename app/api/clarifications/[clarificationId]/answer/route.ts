import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { clarificationAnswerSchema } from "@/lib/validation/round";
import { uuidSchema } from "@/lib/validation/team";

/** POST /api/clarifications/{id}/answer { answer } → 200. The starter of the exchange or the team lead answers. */
export async function POST(request: Request, ctx: RouteContext<"/api/clarifications/[clarificationId]/answer">) {
  const { clarificationId } = await ctx.params;
  if (!uuidSchema.safeParse(clarificationId).success) return apiError(404, "not_found", "Die Rückfrage gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, clarificationAnswerSchema);
  if ("response" in body) return body.response;

  const { error } = await supabase.rpc("answer_clarification", { p_id: clarificationId, p_answer: body.data.answer });
  if (error?.code === "P0002") return apiError(404, "not_found", "Die Rückfrage gibt es nicht.");
  if (error?.code === "42501") return apiError(403, "forbidden", "Antworten kann, wer den Austausch gestartet hat, oder die Teamleitung.");
  if (error) return apiError(500, "save_failed", "Die Antwort konnte nicht gespeichert werden.");
  return Response.json({ ok: true });
}
