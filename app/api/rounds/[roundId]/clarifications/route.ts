import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { clarificationSchema } from "@/lib/validation/round";
import { uuidSchema } from "@/lib/validation/team";

/**
 * POST /api/rounds/{roundId}/clarifications { body, questionId? } → 201 { id }.
 * A follow-up question to the person who started the exchange, while it is open.
 * Everyone in the team sees it, without the author.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/rounds/[roundId]/clarifications">) {
  const { roundId } = await ctx.params;
  if (!uuidSchema.safeParse(roundId).success) return apiError(404, "not_found", "Den Austausch gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, clarificationSchema);
  if ("response" in body) return body.response;

  const { data, error } = await supabase
    .from("round_clarifications")
    .insert({ round_id: roundId, question_id: body.data.questionId ?? null, body: body.data.body })
    .select("id")
    .single();
  if (error?.code === "42501") return apiError(409, "round_closed", "Rückfragen gehen nur, solange der Austausch läuft.");
  if (error || !data) return apiError(500, "create_failed", "Die Rückfrage konnte nicht gespeichert werden.");
  return Response.json({ id: data.id }, { status: 201 });
}
