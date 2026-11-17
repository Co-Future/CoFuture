import { z } from "zod";

/** What the model must return (validated with Zod, sent as JSON Schema). */
export const modelMapSchema = z.object({
  clusters: z.array(
    z.object({
      title: z.string().min(1),
      kind: z.enum(["consensus", "dissent", "single_voice", "off_topic"]),
      summary: z.string().min(1),
      source_ids: z.array(z.string()),
    }),
  ),
  open_questions: z.array(z.object({ question: z.string().min(1), source_ids: z.array(z.string()) })),
});
export type ModelMap = z.infer<typeof modelMapSchema>;

export const modelMapJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["clusters", "open_questions"],
  properties: {
    clusters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "kind", "summary", "source_ids"],
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["consensus", "dissent", "single_voice", "off_topic"] },
          summary: { type: "string" },
          source_ids: { type: "array", items: { type: "string" } },
        },
      },
    },
    open_questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "source_ids"],
        properties: { question: { type: "string" }, source_ids: { type: "array", items: { type: "string" } } },
      },
    },
  },
} as const;

/** What we store and show: every statement has at least one valid source; nothing is left out. */
export type ClusterKind = ModelMap["clusters"][number]["kind"] | "unassigned";
export type PerspectiveMapData = {
  clusters: { title: string; kind: ClusterKind; summary: string; source_ids: string[] }[];
  open_questions: { question: string; source_ids: string[] }[];
};
