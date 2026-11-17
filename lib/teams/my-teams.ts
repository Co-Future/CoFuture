import { cache } from "react";
import { createClient } from "@/lib/db/server";

export type MyTeam = { id: string; name: string; role: "lead" | "member"; openRounds: number };

// Perspective colors in the fixed order from the design language, used as dots only.
const DOT_CLASSES = ["bg-cat-blau", "bg-cat-orange", "bg-cat-teal", "bg-cat-pflaume", "bg-cat-gold", "bg-cat-schiefer"];

export function teamDotClass(index: number): string {
  return DOT_CLASSES[index % DOT_CLASSES.length]!;
}

/**
 * Teams of the signed-in user in the given organization (or teams without one when null),
 * by name, with the number of open rounds. Deduplicated per request.
 */
export const getMyTeams = cache(async (userId: string, organizationId: string | null): Promise<MyTeam[]> => {
  const supabase = await createClient();
  let query = supabase
    .from("teams")
    .select("id, name, team_members!inner(role), rounds(status)")
    .eq("team_members.user_id", userId)
    .order("name");
  query = organizationId ? query.eq("organization_id", organizationId) : query.is("organization_id", null);
  const { data } = await query;
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    role: t.team_members[0]?.role ?? "member",
    openRounds: t.rounds.filter((r) => r.status === "open").length,
  }));
});
