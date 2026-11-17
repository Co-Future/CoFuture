import { buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from "@/prompts/v1/perspective-map";
import { generateStructured } from "./llm";
import { modelMapJsonSchema, modelMapSchema, type ModelMap, type PerspectiveMapData } from "./schema";

export type MapInput = { question: string; context: string | null; responses: { id: string; text: string }[] };

export type MapResult = {
  map: PerspectiveMapData;
  provider: string;
  model: string;
  promptVersion: string;
  ms: number;
  responseCount: number;
  coveredByModel: number;
};

/**
 * Enforces the design principles on whatever the model returned:
 * - Belegbar: unknown or missing source ids are dropped; statements without a source are discarded.
 * - Nothing is lost: answers the model did not place go into an explicit "unassigned" cluster.
 */
export function finalizeMap(raw: ModelMap, knownIds: string[]): { map: PerspectiveMapData; coveredByModel: number } {
  const known = new Set(knownIds);
  const clean = (ids: string[]) => [...new Set(ids.map((id) => id.trim().toUpperCase()))].filter((id) => known.has(id));

  const clusters: PerspectiveMapData["clusters"] = raw.clusters
    .map((c) => ({ ...c, title: c.title.trim(), summary: c.summary.trim(), source_ids: clean(c.source_ids) }))
    .filter((c) => c.source_ids.length > 0);
  const open_questions = raw.open_questions
    .map((q) => ({ question: q.question.trim(), source_ids: clean(q.source_ids) }))
    .filter((q) => q.source_ids.length > 0);

  const covered = new Set(clusters.flatMap((c) => c.source_ids));
  const missing = knownIds.filter((id) => !covered.has(id));
  if (missing.length > 0) {
    clusters.push({
      title: "Nicht zugeordnet",
      kind: "unassigned",
      summary: "Diese Beiträge hat AsyncMeet keinem Thema zugeordnet. Lies sie im Original.",
      source_ids: missing,
    });
  }
  return { map: { clusters, open_questions }, coveredByModel: covered.size };
}

/** Builds the perspective map for a closed round. Only pseudonyms and answer texts go to the model. */
export async function buildPerspectiveMap(input: MapInput): Promise<MapResult> {
  const result = await generateStructured({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    jsonSchema: modelMapJsonSchema,
    schema: modelMapSchema,
  });
  const ids = input.responses.map((r) => r.id);
  const { map, coveredByModel } = finalizeMap(result.data, ids);
  return {
    map,
    provider: result.provider,
    model: result.model,
    promptVersion: PROMPT_VERSION,
    ms: result.ms,
    responseCount: ids.length,
    coveredByModel,
  };
}
