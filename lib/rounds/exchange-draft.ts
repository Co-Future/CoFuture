import { z } from "zod";

/** A question while the exchange is being prepared. `change` marks what the last recording did. */
export type DraftQuestion = {
  key: string;
  body: string;
  targets: string[];
  change?: "modified" | "added";
  /** The person preparing the exchange answers this question too. */
  asksStarter?: boolean;
};

const extractedSchema = z.object({
  questions: z.array(
    z.object({
      body: z.string(),
      basedOn: z.string().nullable(),
      change: z.enum(["unchanged", "modified", "added"]),
      targets: z.array(z.string()),
    }),
  ),
});

/**
 * Applies a dictated recording to the questions in the form.
 * - With AsyncMeet's structure: the new list, existing questions keep their key, changes are marked.
 *   After "replace" nothing is marked, because everything is new anyway.
 * - Without structure (AsyncMeet failed): the transcript is added as one question, if it fits.
 */
export function applyDictatedQuestions(
  current: DraftQuestion[],
  result: { text: string; structured?: unknown },
  mode: "replace" | "merge",
  newKey: () => string,
): { questions: DraftQuestion[]; note: string } {
  const parsed = extractedSchema.safeParse(result.structured);
  if (!parsed.success || parsed.data.questions.length === 0) {
    const text = result.text.trim();
    const base = mode === "replace" ? [] : current;
    if (text.length >= 3 && text.length <= 500) {
      return {
        questions: [...base, { key: newKey(), body: text, targets: [], change: "added" }],
        note: "AsyncMeet konnte die Aufnahme nicht in einzelne Fragen teilen. Der Text steht als eine Frage unten, teil ihn bei Bedarf selbst auf.",
      };
    }
    return {
      questions: base,
      note: "AsyncMeet hat in der Aufnahme keine Frage gefunden. Sprich sie noch einmal ein oder schreib sie unten.",
    };
  }

  const known = new Set(current.map((q) => q.key));
  const questions = parsed.data.questions.map((q) => {
    const key = q.basedOn && known.has(q.basedOn) ? q.basedOn : newKey();
    const change = mode === "replace" || q.change === "unchanged" ? undefined : q.change;
    const asksStarter = current.find((c) => c.key === key)?.asksStarter;
    return { key, body: q.body, targets: q.targets, ...(change ? { change } : {}), ...(asksStarter ? { asksStarter } : {}) };
  });
  const added = questions.filter((q) => q.change === "added").length;
  const modified = questions.filter((q) => q.change === "modified").length;
  const note =
    mode === "replace"
      ? `AsyncMeet hat ${questions.length === 1 ? "1 Frage" : `${questions.length} Fragen`} herausgezogen. Prüf sie, bevor du den Austausch startest.`
      : `AsyncMeet hat ${added} ${added === 1 ? "Frage" : "Fragen"} ergänzt und ${modified} geändert. Markierte Fragen bitte prüfen.`;
  return { questions, note };
}

/**
 * How many questions this person gets. A question without targets goes to everyone except the person
 * who starts the exchange; they get only the questions they chose to answer themselves.
 */
export function questionCountFor(
  questions: { targets: string[]; asksStarter?: boolean }[],
  userId: string,
  starterId?: string,
): number {
  return questions.filter((q) =>
    q.targets.includes(userId) || (userId === starterId ? Boolean(q.asksStarter) : q.targets.length === 0),
  ).length;
}
