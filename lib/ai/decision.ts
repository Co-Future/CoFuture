import { z } from "zod";
import {
  buildDictationPrompt,
  buildProposalPrompt,
  DICTATION_SYSTEM_PROMPT,
  PROMPT_VERSION,
  PROPOSAL_SYSTEM_PROMPT,
} from "@/prompts/v1/decision";
import { generateStructured } from "./llm";

// ---------------------------------------------------------------------------
// Proposals: AsyncMeet suggests, a person decides (roadmap 7c)
// ---------------------------------------------------------------------------

const proposalSchema = z.object({
  proposals: z.array(z.object({ body: z.string(), rationale: z.string(), group_ids: z.array(z.string()) })),
  insufficient: z.boolean(),
});
type ModelProposals = z.infer<typeof proposalSchema>;

const proposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["proposals", "insufficient"],
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["body", "rationale", "group_ids"],
        properties: {
          body: { type: "string" },
          rationale: { type: "string" },
          group_ids: { type: "array", items: { type: "string" } },
        },
      },
    },
    insufficient: { type: "boolean" },
  },
} as const;

/** A summary point the proposal can rely on; index is its position in the map (decisions.cluster_refs). */
export type ProposalGroup = {
  index: number;
  question: number | null;
  kind: string;
  title: string;
  summary: string;
  count: number;
  answered: number;
};
export type Proposal = { body: string; rationale: string; clusterRefs: number[] };

const groupKey = (i: number) => `G${i + 1}`;
/** Internal group ids like "(G1)" or "(G1, G3)" must never reach the person. */
const stripGroupIds = (text: string) => text.replace(/\s*\((?:G\d+(?:\s*[,/und]+\s*)?)+\)/g, "").replace(/\bG\d+\b/g, "").replace(/\s{2,}/g, " ").trim();

/**
 * Belegbar: group ids are mapped back to map positions, unknown ones dropped. A proposal without at
 * least one valid group, or with an empty text, is discarded. At most two.
 */
export function finalizeProposals(raw: ModelProposals, groups: ProposalGroup[]): Proposal[] {
  if (raw.insufficient) return [];
  const byKey = new Map(groups.map((g, i) => [groupKey(i), g.index]));
  return raw.proposals
    .map((p) => ({
      body: stripGroupIds(p.body).slice(0, 2000),
      rationale: stripGroupIds(p.rationale).slice(0, 4000),
      clusterRefs: [
        ...new Set(p.group_ids.map((id) => byKey.get(id.trim().toUpperCase())).filter((i): i is number => i !== undefined)),
      ].sort((a, b) => a - b),
    }))
    .filter((p) => p.body.length >= 3 && p.rationale.length >= 3 && p.clusterRefs.length > 0)
    .slice(0, 2);
}

/** Only questions, summaries and group texts go to the model, no names. */
export async function proposeDecision(input: {
  questions: { number: number; body: string; overview: string | null }[];
  groups: ProposalGroup[];
}): Promise<{ proposals: Proposal[]; model: string; promptVersion: string }> {
  const result = await generateStructured({
    system: PROPOSAL_SYSTEM_PROMPT,
    user: buildProposalPrompt({ questions: input.questions, groups: input.groups.map((g, i) => ({ ...g, id: groupKey(i) })) }),
    jsonSchema: proposalJsonSchema,
    schema: proposalSchema,
    // Someone waits in the form.
    timeoutMs: 20_000,
  });
  return { proposals: finalizeProposals(result.data, input.groups), model: result.model, promptVersion: PROMPT_VERSION };
}

// ---------------------------------------------------------------------------
// Dictation: a spoken decision split into decision and rationale
// ---------------------------------------------------------------------------

const dictationSchema = z.object({ body: z.string(), rationale: z.string() });
const dictationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["body", "rationale"],
  properties: { body: { type: "string" }, rationale: { type: "string" } },
} as const;

export type DictatedDecision = { body: string; rationale: string };

/** Falls back to the whole transcript as decision text when the model returns nothing usable. */
export function finalizeDictation(raw: z.infer<typeof dictationSchema>, transcript: string): DictatedDecision {
  const body = raw.body.trim() || transcript.trim();
  return { body: body.slice(0, 2000), rationale: raw.rationale.trim().slice(0, 4000) };
}

export async function splitDictatedDecision(
  transcript: string,
): Promise<DictatedDecision & { model: string; promptVersion: string }> {
  const result = await generateStructured({
    system: DICTATION_SYSTEM_PROMPT,
    user: buildDictationPrompt(transcript),
    jsonSchema: dictationJsonSchema,
    schema: dictationSchema,
    timeoutMs: 15_000,
  });
  return { ...finalizeDictation(result.data, transcript), model: result.model, promptVersion: PROMPT_VERSION };
}
