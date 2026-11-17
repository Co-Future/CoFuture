import { apiError, readJson, requireUserId } from "@/lib/api/respond";
import { createClient } from "@/lib/db/server";
import { responseSchema } from "@/lib/validation/round";
import { uuidSchema } from "@/lib/validation/team";

const CLOSED = "Die Runde ist geschlossen. Antworten lassen sich nicht mehr ändern.";

/** PUT /api/rounds/{roundId}/response { body } → 200 { pseudonym }. Creates or updates your own answer. */
export async function PUT(request: Request, ctx: RouteContext<"/api/rounds/[roundId]/response">) {
  const { roundId } = await ctx.params;
  if (!uuidSchema.safeParse(roundId).success) return apiError(404, "not_found", "Die Runde gibt es nicht.");

  const supabase = await createClient();
  const auth = await requireUserId(supabase);
  if ("response" in auth) return auth.response;

  const body = await readJson(request, responseSchema);
  if ("response" in body) return body.response;

  // The base table only ever shows your own answer (RLS).
  const { data: existing } = await supabase.from("responses").select("id").eq("round_id", roundId).maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("responses")
      .update({ body: body.data.body, source: "text" })
      .eq("id", existing.id)
      .select("pseudonym");
    if (error) return apiError(500, "save_failed", "Die Antwort konnte nicht gespeichert werden.");
    if (data.length === 0) return apiError(409, "round_closed", CLOSED);
    return Response.json({ pseudonym: data[0].pseudonym });
  }

  const { data, error } = await supabase
    .from("responses")
    .insert({ round_id: roundId, body: body.data.body, source: "text" })
    .select("pseudonym")
    .single();
  // Insert is refused by RLS when the round is closed, past its deadline or not your team's.
  if (error?.code === "42501") return apiError(409, "round_closed", CLOSED);
  if (error || !data) return apiError(500, "save_failed", "Die Antwort konnte nicht gespeichert werden.");
  return Response.json({ pseudonym: data.pseudonym }, { status: 201 });
}
