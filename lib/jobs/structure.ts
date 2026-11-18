import { extractQuestions, mapAnswers, type DraftQuestion } from "@/lib/ai/exchange";
import type { createAdminClient } from "@/lib/db/admin";
import type { Database, Json } from "@/lib/db/types";

type Admin = ReturnType<typeof createAdminClient>;
type Job = Database["public"]["Tables"]["analysis_jobs"]["Row"];

/** Questions of an exchange that address this person, in order (same rule as question_is_for_me). */
export async function questionsFor(admin: Admin, roundId: string, userId: string | null) {
  const [{ data: round }, { data }] = await Promise.all([
    admin.from("rounds").select("created_by").eq("id", roundId).maybeSingle(),
    admin
      .from("round_questions")
      .select("id, body, position, asks_starter, round_question_targets(user_id)")
      .eq("round_id", roundId)
      .order("position"),
  ]);
  const isStarter = Boolean(userId) && round?.created_by === userId;
  return (data ?? [])
    .filter(
      (q) =>
        q.round_question_targets.some((t) => t.user_id === userId) ||
        (isStarter ? q.asks_starter : q.round_question_targets.length === 0),
    )
    .map((q) => ({ id: q.id, body: q.body }));
}

/**
 * After transcription: turn the text into structure, as far as the job asks for it.
 * - Team job (new exchange): the question list, reconciled with the questions so far.
 * - Exchange job: the answer summarised per question (all your questions, or one card).
 * Returns null when there is nothing to do. Throws on LLM errors; the caller keeps the transcript.
 */
export async function structureTranscript(admin: Admin, job: Job, text: string): Promise<Json | null> {
  const payload = (job.payload ?? {}) as { mode?: "replace" | "merge"; questions?: DraftQuestion[]; scope?: string; questionId?: string };

  if (!job.round_id && job.team_id) {
    // Display names only: no e-mail addresses, no ids go to the model.
    const { data: members } = await admin
      .from("team_members")
      .select("user_id, profiles(display_name)")
      .eq("team_id", job.team_id);
    const people = (members ?? []).map((m) => ({ userId: m.user_id, name: m.profiles?.display_name ?? "Unbekannt" }));
    const existing = payload.mode === "merge" ? (payload.questions ?? []) : [];
    const result = await extractQuestions({ transcript: text, existing, people });
    return { questions: result.questions, mode: payload.mode ?? "replace", model: result.model, promptVersion: result.promptVersion } as Json;
  }

  if (job.round_id) {
    // "all": split across your questions. "question": summarise for that one card.
    const all = await questionsFor(admin, job.round_id, job.created_by);
    const questions = payload.scope === "question" ? all.filter((q) => q.id === payload.questionId) : all;
    if (questions.length === 0) return null;
    const result = await mapAnswers({ transcript: text, questions });
    return { answers: result.answers, unassigned: result.unassigned, model: result.model, promptVersion: result.promptVersion } as Json;
  }
  return null;
}
