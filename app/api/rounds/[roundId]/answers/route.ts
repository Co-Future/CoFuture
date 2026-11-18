import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { saveAnswersSchema } from "@/lib/validation/round";
import { uuidSchema } from "@/lib/validation/team";

/**
 * PUT /api/rounds/{roundId}/answers { answers: [{ questionId, body }], source? } → 200 { pseudonym }.
 * Saves your answers to the questions addressed to you while the exchange is open.
 * An empty body removes that answer; no answer at all removes your response (pseudonym null).
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/rounds/[roundId]/answers">) {
  const { roundId } = await ctx.params;
  if (!uuidSchema.safeParse(roundId).success) return apiError(404, "not_found", "Den Austausch gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, saveAnswersSchema);
  if ("response" in body) return body.response;

  const { data, error } = await supabase.rpc("save_answers", {
    p_round_id: roundId,
    p_answers: body.data.answers.map((a) => ({ question_id: a.questionId, body: a.body })),
    p_source: body.data.source,
  });
  if (error?.code === "P0002") return apiError(404, "not_found", "Den Austausch gibt es nicht.");
  if (error?.hint === "round_closed") return apiError(409, "round_closed", "Der Austausch ist geschlossen. Antworten lassen sich nicht mehr ändern.");
  if (error?.hint === "invalid_question") return apiError(400, "invalid_question", "Eine der Fragen geht nicht an dich.");
  if (error) return apiError(500, "save_failed", "Die Antworten konnten nicht gespeichert werden.");
  return Response.json({ pseudonym: data ?? null });
}
