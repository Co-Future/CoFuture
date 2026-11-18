import { z } from "zod";

const mappedSchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), text: z.string() })),
  unassigned: z.string(),
});

const join = (a: string, b: string) => (a.trim() ? `${a.trim()}\n\n${b.trim()}` : b.trim());

/**
 * Applies a spoken answer to the answer cards.
 * - "replace": the cards hold exactly what AsyncMeet assigned from this recording.
 * - "merge": each assigned part is appended to what the card already says.
 * Without structure (AsyncMeet failed) the whole transcript stays visible as unassigned, nothing is lost.
 */
export function applySpokenAnswers(
  current: Record<string, string>,
  result: { text: string; structured?: unknown },
  mode: "replace" | "merge",
  questionIds: string[],
): { answers: Record<string, string>; unassigned: string; note: string } {
  const parsed = mappedSchema.safeParse(result.structured);
  if (!parsed.success) {
    return {
      answers: current,
      unassigned: result.text.trim(),
      note: "AsyncMeet konnte die Aufnahme nicht den Fragen zuordnen. Der Text steht unter „Nicht zugeordnet“, übernimm ihn in die passenden Karten.",
    };
  }
  const allowed = new Set(questionIds);
  const next: Record<string, string> = mode === "replace" ? {} : { ...current };
  let assigned = 0;
  for (const a of parsed.data.answers) {
    if (!allowed.has(a.questionId) || !a.text.trim()) continue;
    next[a.questionId] = join(next[a.questionId] ?? "", a.text);
    assigned++;
  }
  const note =
    assigned === 0
      ? "AsyncMeet hat in der Aufnahme keine Antwort auf deine Fragen gefunden."
      : `AsyncMeet hat deine Aufnahme ${assigned === 1 ? "1 Frage" : `${assigned} Fragen`} zugeordnet. Prüf jede Karte und korrigier sie bei Bedarf.`;
  return { answers: next, unassigned: parsed.data.unassigned.trim(), note };
}

/** Appends a spoken supplement to one card. */
export function appendToAnswer(current: Record<string, string>, questionId: string, text: string): Record<string, string> {
  return { ...current, [questionId]: join(current[questionId] ?? "", text) };
}
