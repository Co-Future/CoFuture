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
  raw: unknown;
  failures: string[];
};

/**
 * Maps what the model wrote to a known answer id. Models sometimes shorten or decorate ids
 * ("A1", "a01", "#A01", "Antwort A01"), which used to drop every source of a map.
 */
export function idResolver(knownIds: string[]): (id: string) => string | null {
  const byNumber = new Map<number, string>();
  for (const id of knownIds) {
    const match = /^A(\d+)$/.exec(id);
    if (match) byNumber.set(Number(match[1]), id);
  }
  const known = new Set(knownIds);
  return (id) => {
    const upper = id.trim().toUpperCase();
    if (known.has(upper)) return upper;
    const match = /^(?:\W|ANTWORT|RESPONSE)*\s*A?0*(\d+)\W*$/.exec(upper);
    return match ? (byNumber.get(Number(match[1])) ?? null) : null;
  };
}

/**
 * Enforces the design principles on whatever the model returned:
 * - Belegbar: unknown or missing source ids are dropped; statements without a source are discarded.
 * - Nothing is lost: answers the model did not place go into an explicit "unassigned" cluster.
 */
export function finalizeMap(raw: ModelMap, knownIds: string[]): { map: PerspectiveMapData; coveredByModel: number } {
  const resolve = idResolver(knownIds);
  const clean = (ids: string[]) => [...new Set(ids.map(resolve).filter((id): id is string => id !== null))];

  const clusters: PerspectiveMapData["clusters"] = raw.clusters
    .map((c) => {
      const source_ids = clean(c.source_ids);
      // Dissent means several people share it. A single objection is a single voice (Minderheiten sichtbar).
      const kind = c.kind === "dissent" && source_ids.length === 1 && knownIds.length > 1 ? "single_voice" : c.kind;
      return { ...c, kind, title: c.title.trim(), summary: c.summary.trim(), source_ids };
    })
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
    raw: result.raw,
    failures: result.failures,
  };
}
