import { z } from "zod";

const MAX_DAYS = 60;

export const createRoundSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Die Frage braucht mindestens 3 Zeichen.")
    .max(500, "Die Frage darf höchstens 500 Zeichen haben."),
  context: z
    .string()
    .trim()
    .max(4000, "Der Kontext darf höchstens 4.000 Zeichen haben.")
    .optional()
    .transform((value) => (value ? value : undefined)),
  deadline: z.iso
    .datetime({ offset: true, message: "Wähle eine Frist." })
    .refine((value) => Date.parse(value) > Date.now() + 60_000, "Die Frist muss in der Zukunft liegen.")
    .refine(
      (value) => Date.parse(value) < Date.now() + MAX_DAYS * 86_400_000,
      `Die Frist darf höchstens ${MAX_DAYS} Tage in der Zukunft liegen.`,
    ),
});

export const responseSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Schreib eine Antwort.")
    .max(10000, "Die Antwort darf höchstens 10.000 Zeichen haben."),
});

export const closeRoundSchema = z.object({ status: z.literal("closed") });

export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type ResponseInput = z.infer<typeof responseSchema>;
