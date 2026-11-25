import { apiError, requireUserId } from "@/lib/api/respond";
import { proposeDecision } from "@/lib/ai/decision";
import { createClient } from "@/lib/db/server";
import { loadDecisionContext } from "@/lib/decisions/context";
import { uuidSchema } from "@/lib/validation/team";

export const maxDuration = 60;

/**
 * POST /api/rounds/{roundId}/decision/proposal → 200 { proposals, model, promptVersion }.
 * AsyncMeet proposes up to two decisions from the summary, each with the summary points it relies on.
 * Nothing is stored: a person takes over, changes or discards the proposal and decides.
 * Round creator or team lead, no guests, closed and not yet decided. Short call in the request (like ADR 013, 8c).
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/rounds/[roundId]/decision/proposal">) {
  const { roundId } = await ctx.params;
  if (!uuidSchema.safeParse(roundId).success) return apiError(404, "not_found", "Den Austausch gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const context = await loadDecisionContext(supabase, roundId, auth.userId);
  if (!context.ok) return apiError(context.status, context.code, context.message);
  if (context.groups.length === 0) return Response.json({ proposals: [], model: null, promptVersion: null });

  try {
    const result = await proposeDecision({ questions: context.questions, groups: context.groups });
    return Response.json(result);
  } catch (error) {
    console.error("decision proposal failed", String(error));
    return apiError(
      503,
      "proposal_failed",
      "AsyncMeet ist gerade ausgelastet. Schreib den Beschluss selbst oder versuch es gleich noch einmal.",
    );
  }
}
