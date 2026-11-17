import { z } from "zod";
import { buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from "@/prompts/v1/question-draft";
import { generateStructured } from "./llm";

const modelDraftSchema = z.object({
  questions: z.array(z.string()),
  context: z.string(),
});

const modelDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questions", "context"],
  properties: {
    questions: { type: "array", items: { type: "string" } },
    context: { type: "string" },
  },
} as const;

/** Suggestion for the round form. The person checks and edits it before starting the round. */
export type QuestionDraft = {
  question: string;
  context: string;
  /** Further questions from the same recording. Rounds have one question for now (see README). */
  moreQuestions: string[];
  model: string;
  promptVersion: string;
};

const QUESTION_MAX = 500;
const CONTEXT_MAX = 4000;

/** Trims the model output to what the round form accepts. Returns null when no question was found. */
export function finalizeDraft(raw: z.infer<typeof modelDraftSchema>): Omit<QuestionDraft, "model" | "promptVersion"> | null {
  const questions = raw.questions.map((q) => q.trim()).filter((q) => q.length >= 3).map((q) => q.slice(0, QUESTION_MAX));
  if (questions.length === 0) return null;
  const [question, ...moreQuestions] = questions;
  return { question, moreQuestions, context: raw.context.trim().slice(0, CONTEXT_MAX) };
}

/** Suggests question and context from a dictated transcript. Only the transcript goes to the model. */
export async function draftQuestion(transcript: string): Promise<QuestionDraft | null> {
  const result = await generateStructured({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(transcript),
    jsonSchema: modelDraftJsonSchema,
    schema: modelDraftSchema,
  });
  const draft = finalizeDraft(result.data);
  return draft ? { ...draft, model: result.model, promptVersion: PROMPT_VERSION } : null;
}
