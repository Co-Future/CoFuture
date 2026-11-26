import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposalGroup } from "@/lib/ai/decision";
import type { Database } from "@/lib/db/types";
import { weightOf } from "@/lib/exchange/weights";

type Tagged = { question_id?: string | null };
type MapCluster = Tagged & { title: string; kind: string; summary: string; source_ids: string[] };
type MapOverview = Tagged & { text: string; source_ids: string[] };

export type DecisionContext =
  | { ok: false; status: 403 | 404 | 409; code: string; message: string }
  | {
      ok: true;
      questions: { number: number; body: string; overview: string | null }[];
      groups: ProposalGroup[];
    };

/**
 * What a decision can rely on, read with the rights of the signed-in person: questions they may see,
 * the summary per question and the summary points with their weight (counted by the code).
 * Also checks that this person may decide (round creator or team lead, no guest, closed, not decided).
 */
export async function loadDecisionContext(
  supabase: SupabaseClient<Database>,
  roundId: string,
  userId: string,
): Promise<DecisionContext> {
  const { data: round } = await supabase.from("rounds").select("id, team_id, status, created_by").eq("id", roundId).maybeSingle();
  if (!round) return { ok: false, status: 404, code: "not_found", message: "Den Austausch gibt es nicht." };

  const [
    { data: lead },
    { data: isGuest },
    { data: decision },
    { data: questionRows },
    { data: answerRows },
    { data: analysis },
  ] = await Promise.all([
    supabase
      .from("team_members")
      .select("role")
      .eq("team_id", round.team_id)
      .eq("user_id", userId)
      .eq("role", "lead")
      .maybeSingle(),
    supabase.rpc("is_guest_for_team", { p_team_id: round.team_id }),
    supabase.from("decisions").select("id").eq("round_id", roundId).maybeSingle(),
    supabase.from("round_questions").select("id, position, body").eq("round_id", roundId).order("position"),
    supabase.from("round_answers").select("question_id, pseudonym").eq("round_id", roundId),
    supabase.rpc("round_analysis", { p_round_id: roundId }).maybeSingle(),
  ]);

  if (isGuest || !(round.created_by === userId || lead)) {
    return {
      ok: false,
      status: 403,
      code: "forbidden",
      message: "Beschließen kann nur, wer den Austausch gestartet hat, oder die Teamleitung.",
    };
  }
  if (round.status === "open") return { ok: false, status: 409, code: "round_open", message: "Der Austausch läuft noch." };
  if (decision || round.status === "decided") {
    return { ok: false, status: 409, code: "already_decided", message: "Für diesen Austausch gibt es schon einen Beschluss." };
  }
  if (!analysis)
    return {
      ok: false,
      status: 409,
      code: "no_summary",
      message: "Es gibt noch keine Zusammenfassung, auf die sich ein Vorschlag stützen kann.",
    };

  const questions = (questionRows ?? []).map((q, i) => ({ id: q.id, number: i + 1, body: q.body }));
  const firstId = questions[0]?.id;
  const belongs = (item: Tagged, qId: string) => (item.question_id ?? firstId) === qId;
  const map = analysis.map as { clusters?: (MapCluster | null)[]; overviews?: (MapOverview | null)[] };
  const answersOf = (qId: string) =>
    (answerRows ?? []).filter((a) => a.question_id === qId && a.pseudonym).map((a) => a.pseudonym!);

  const groups: ProposalGroup[] = (map.clusters ?? []).flatMap((c, index) => {
    if (!c || c.kind === "unassigned") return [];
    const q = questions.find((x) => belongs(c, x.id));
    if (!q) return [];
    const weight = weightOf(c.source_ids, answersOf(q.id));
    return [
      {
        index,
        question: questions.length > 1 ? q.number : null,
        kind: c.kind,
        title: c.title,
        summary: c.summary,
        count: weight.count,
        answered: weight.answered,
      },
    ];
  });

  return {
    ok: true,
    questions: questions.map((q) => ({
      number: q.number,
      body: q.body,
      overview: (map.overviews ?? []).find((v) => v && belongs(v, q.id))?.text ?? null,
    })),
    groups,
  };
}
