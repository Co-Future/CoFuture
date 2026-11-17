import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { closeRoundSchema } from "@/lib/validation/round";
import { uuidSchema } from "@/lib/validation/team";

/** PATCH /api/rounds/{roundId} { status: "closed" } → 200. Closes a round early; creator or lead. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/rounds/[roundId]">) {
  const { roundId } = await ctx.params;
  if (!uuidSchema.safeParse(roundId).success) return apiError(404, "not_found", "Die Runde gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, closeRoundSchema);
  if ("response" in body) return body.response;

  const { data, error } = await supabase
    .from("rounds")
    .update({ status: body.data.status })
    .eq("id", roundId)
    .select("id, status");

  if (error?.hint === "invalid_status") return apiError(409, "invalid_status", "Die Runde ist schon geschlossen.");
  if (error) return apiError(500, "update_failed", "Die Runde konnte nicht geschlossen werden.");
  if (data.length === 0) return apiError(403, "forbidden", "Nur wer die Runde gestartet hat oder die Teamleitung kann sie schließen.");
  return Response.json(data[0]);
}
