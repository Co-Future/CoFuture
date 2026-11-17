import { z } from "zod";

export const decisionSchema = z.object({
  body: z
    .string()
    .trim()
    .min(3, "Beschreib den Beschluss in mindestens 3 Zeichen.")
    .max(2000, "Der Beschluss darf höchstens 2.000 Zeichen haben."),
  rationale: z
    .string()
    .trim()
    .min(3, "Begründe den Beschluss in mindestens 3 Zeichen.")
    .max(4000, "Die Begründung darf höchstens 4.000 Zeichen haben."),
  /** Indexes of the perspective-map clusters the rationale refers to. */
  clusterRefs: z
    .array(z.int().min(0).max(99))
    .max(20)
    .default([])
    .transform((refs) => [...new Set(refs)].sort((a, b) => a - b)),
});

export type DecisionInput = z.input<typeof decisionSchema>;
