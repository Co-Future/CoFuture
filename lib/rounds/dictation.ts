import { z } from "zod";

const draftSchema = z.object({ question: z.string(), context: z.string(), moreQuestions: z.array(z.string()) });

/** Fills question and context from a dictated recording. AsyncMeet only suggests; the person edits. */
export function applyDictation(result: { text: string; draft?: unknown }): { question: string; context: string; note: string } {
  const draft = draftSchema.safeParse(result.draft);
  if (!draft.success) {
    return {
      question: "",
      context: result.text,
      note: "AsyncMeet hat in der Aufnahme keine klare Frage gefunden. Das Transkript steht im Kontext, formulier die Frage bitte selbst.",
    };
  }
  const { question, context, moreQuestions } = draft.data;
  if (moreQuestions.length === 0) {
    return { question, context, note: "AsyncMeet hat Frage und Kontext aus deiner Aufnahme vorgeschlagen. Prüf beides, bevor du die Runde startest." };
  }
  const list = moreQuestions.map((q) => `- ${q}`).join("\n");
  return {
    question,
    context: [context, `Weitere Fragen aus der Aufnahme:\n${list}`].filter(Boolean).join("\n\n"),
    note: `AsyncMeet hat ${moreQuestions.length + 1} Fragen gefunden. Eine Runde hat vorerst eine Hauptfrage, die weiteren stehen im Kontext. Prüf alles, bevor du die Runde startest.`,
  };
}
