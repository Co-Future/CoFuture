import { z } from "zod";
import { buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from "@/prompts/v1/knowledge-answer";
import { generateStructured } from "./llm";

/** What the model must return (validated with Zod, sent as JSON Schema). */
export const answerSchema = z.object({
  statements: z.array(z.object({ text: z.string().min(1), source_ids: z.array(z.string()) })),
  insufficient: z.boolean(),
});
export type ModelAnswer = z.infer<typeof answerSchema>;

const answerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["statements", "insufficient"],
  properties: {
    statements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "source_ids"],
        properties: { text: { type: "string" }, source_ids: { type: "array", items: { type: "string" } } },
      },
    },
    insufficient: { type: "boolean" },
  },
} as const;

export type AnswerSource = { id: string; kind: string; title: string; question: string; content: string; date: string };
export type Answer = {
  statements: { text: string; sourceIds: string[] }[];
  provider: string;
  model: string;
  promptVersion: string;
  ms: number;
};

/** Belegbar: unknown ids are dropped, statements without a valid source are discarded, at most 5. */
export function finalizeAnswer(raw: ModelAnswer, knownIds: string[]): { text: string; sourceIds: string[] }[] {
  if (raw.insufficient) return [];
  const known = new Set(knownIds);
  return raw.statements
    .map((s) => ({
      text: s.text.trim(),
      sourceIds: [...new Set(s.source_ids.map((id) => id.trim().toUpperCase()))].filter((id) => known.has(id)),
    }))
    .filter((s) => s.text && s.sourceIds.length > 0)
    .slice(0, 5);
}

/** Answers a question from knowledge items. Only texts from the store go to the model, no names. */
export async function answerFromKnowledge(question: string, sources: AnswerSource[]): Promise<Answer> {
  const result = await generateStructured({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt({ question, sources }),
    jsonSchema: answerJsonSchema,
    schema: answerSchema,
    timeoutMs: 20_000,
  });
  return {
    statements: finalizeAnswer(
      result.data,
      sources.map((s) => s.id),
    ),
    provider: result.provider,
    model: result.model,
    promptVersion: PROMPT_VERSION,
    ms: result.ms,
  };
}
