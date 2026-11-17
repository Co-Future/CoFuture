import { apiError, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/team";

/** POST /api/decisions/{decisionId}/read → 204. Confirms that you have read the decision (idempotent). */
export async function POST(_request: Request, ctx: RouteContext<"/api/decisions/[decisionId]/read">) {
  const { decisionId } = await ctx.params;
  if (!uuidSchema.safeParse(decisionId).success) return apiError(404, "not_found", "Den Beschluss gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const { error } = await supabase
    .from("decision_reads")
    .upsert({ decision_id: decisionId, user_id: auth.userId }, { onConflict: "decision_id,user_id", ignoreDuplicates: true });
  if (error?.code === "42501" || error?.code === "23503") return apiError(404, "not_found", "Den Beschluss gibt es nicht.");
  if (error) return apiError(500, "read_failed", "Die Lesebestätigung konnte nicht gespeichert werden.");
  return new Response(null, { status: 204 });
}
