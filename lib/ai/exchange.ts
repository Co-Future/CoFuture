import { z } from "zod";
import * as answersPrompt from "@/prompts/v1/answers-map";
import * as questionsPrompt from "@/prompts/v1/questions-extract";
import { generateStructured } from "./llm";

/** A question as the start form holds it. `key` is stable while editing (existing id or a client key). */
export type DraftQuestion = { key: string; body: string; targets: string[] };
export type QuestionChange = "unchanged" | "modified" | "added";
export type ExtractedQuestion = { body: string; basedOn: string | null; change: QuestionChange; targets: string[] };

const QUESTION_MAX = 500;
const ANSWER_MAX = 10000;

// ---------------------------------------------------------------------------
// Questions: dictated text → reconciled question list
// ---------------------------------------------------------------------------

const modelQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      body: z.string(),
      based_on: z.string(),
      change: z.enum(["unchanged", "modified", "added"]),
      targets: z.array(z.string()),
    }),
  ),
});
type ModelQuestions = z.infer<typeof modelQuestionsSchema>;

const modelQuestionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["body", "based_on", "change", "targets"],
        properties: {
          body: { type: "string" },
          based_on: { type: "string" },
          change: { type: "string", enum: ["unchanged", "modified", "added"] },
          targets: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

/** F1, F2 … for questions; P1, P2 … for people. The model never sees ids or e-mail addresses. */
const questionKey = (i: number) => `F${i + 1}`;
const personKey = (i: number) => `P${i + 1}`;
const norm = (id: string) => id.trim().toUpperCase().replace(/^#/, "");

/**
 * Maps the model output back to real keys and user ids and enforces the rules:
 * unknown references and people are dropped, an existing question the model left out stays
 * ("nothing gets lost"), and a question without text is discarded.
 */
export function finalizeQuestions(
  raw: ModelQuestions,
  existing: DraftQuestion[],
  people: { userId: string }[],
): ExtractedQuestion[] {
  const byQuestionKey = new Map(existing.map((q, i) => [questionKey(i), q]));
  const byPersonKey = new Map(people.map((p, i) => [personKey(i), p.userId]));

  const result: ExtractedQuestion[] = [];
  const used = new Set<string>();
  for (const q of raw.questions) {
    const body = q.body.trim().slice(0, QUESTION_MAX);
    const base = byQuestionKey.get(norm(q.based_on)) ?? null;
    if (body.length < 3) continue;
    if (base) used.add(base.key);
    const targets = [...new Set(q.targets.map((t) => byPersonKey.get(norm(t))).filter((t): t is string => Boolean(t)))];
    const change: QuestionChange = !base ? "added" : body === base.body && sameSet(targets, base.targets) ? "unchanged" : "modified";
    result.push({ body, basedOn: base?.key ?? null, change, targets });
  }
  // Existing questions the model dropped without being told: keep them at their old position.
  existing.forEach((q, index) => {
    if (used.has(q.key)) return;
    result.splice(Math.min(index, result.length), 0, { body: q.body, basedOn: q.key, change: "unchanged", targets: q.targets });
  });
  return result.slice(0, 50);
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/**
 * Pulls the questions out of a dictated text. With existing questions it reconciles: unchanged,
 * modified or added, and who each question is for. Only display names and texts go to the model.
 */
export async function extractQuestions(input: {
  transcript: string;
  existing: DraftQuestion[];
  people: { userId: string; name: string }[];
}): Promise<{ questions: ExtractedQuestion[]; model: string; promptVersion: string }> {
  const keyOfUser = new Map(input.people.map((p, i) => [p.userId, personKey(i)]));
  const result = await generateStructured({
    system: questionsPrompt.SYSTEM_PROMPT,
    user: questionsPrompt.buildUserPrompt({
      transcript: input.transcript,
      questions: input.existing.map((q, i) => ({
        id: questionKey(i),
        body: q.body,
        targets: q.targets.map((t) => keyOfUser.get(t)).filter((t): t is string => Boolean(t)),
      })),
      people: input.people.map((p, i) => ({ id: personKey(i), name: p.name })),
    }),
    jsonSchema: modelQuestionsJsonSchema,
    schema: modelQuestionsSchema,
    // Someone waits in the form: give up on a slow provider early and use the fallback.
    timeoutMs: 15_000,
  });
  return {
    questions: finalizeQuestions(result.data, input.existing, input.people),
    model: result.model,
    promptVersion: questionsPrompt.PROMPT_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Answers: one spoken answer → part per question
// ---------------------------------------------------------------------------

const modelAnswersSchema = z.object({
  answers: z.array(z.object({ question: z.string(), text: z.string() })),
  unassigned: z.string(),
});
type ModelAnswers = z.infer<typeof modelAnswersSchema>;

const modelAnswersJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answers", "unassigned"],
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "text"],
        properties: { question: { type: "string" }, text: { type: "string" } },
      },
    },
    unassigned: { type: "string" },
  },
} as const;

export type MappedAnswers = { answers: { questionId: string; text: string }[]; unassigned: string };

/** Maps F-keys back to question ids, joins duplicates and keeps unknown parts visible as unassigned. */
export function finalizeAnswers(raw: ModelAnswers, questionIds: string[]): MappedAnswers {
  const byKey = new Map(questionIds.map((id, i) => [questionKey(i), id]));
  const texts = new Map<string, string[]>();
  const leftover: string[] = [];
  for (const a of raw.answers) {
    const text = a.text.trim();
    if (!text) continue;
    const id = byKey.get(norm(a.question));
    if (!id) {
      leftover.push(text);
      continue;
    }
    texts.set(id, [...(texts.get(id) ?? []), text]);
  }
  if (raw.unassigned.trim()) leftover.push(raw.unassigned.trim());
  return {
    answers: questionIds
      .filter((id) => texts.has(id))
      .map((id) => ({ questionId: id, text: texts.get(id)!.join("\n\n").slice(0, ANSWER_MAX) })),
    unassigned: leftover.join("\n\n").slice(0, ANSWER_MAX),
  };
}

/** Splits a spoken answer into one part per question. Only questions and the answer text go to the model. */
export async function mapAnswers(input: {
  transcript: string;
  questions: { id: string; body: string }[];
}): Promise<MappedAnswers & { model: string; promptVersion: string }> {
  const result = await generateStructured({
    system: answersPrompt.SYSTEM_PROMPT,
    user: answersPrompt.buildUserPrompt({
      transcript: input.transcript,
      questions: input.questions.map((q, i) => ({ id: questionKey(i), body: q.body })),
    }),
    jsonSchema: modelAnswersJsonSchema,
    schema: modelAnswersSchema,
    timeoutMs: 15_000,
  });
  return {
    ...finalizeAnswers(
      result.data,
      input.questions.map((q) => q.id),
    ),
    model: result.model,
    promptVersion: answersPrompt.PROMPT_VERSION,
  };
}
