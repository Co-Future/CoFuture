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
  /** Follow-up round (also for a short follow-up question): links to the closed origin round. */
  parentRoundId: z.uuid().optional(),
});

export const responseSchema = z.object({
  source: z.enum(["text", "voice"]).default("text"),
  body: z
    .string()
    .trim()
    .min(1, "Schreib eine Antwort.")
    .max(10000, "Die Antwort darf höchstens 10.000 Zeichen haben."),
});

const questionBody = z
  .string()
  .trim()
  .min(3, "Eine Frage braucht mindestens 3 Zeichen.")
  .max(500, "Eine Frage darf höchstens 500 Zeichen haben.");

/** Start an exchange with several questions. No targets: the question goes to everyone in the team. */
export const createExchangeSchema = z.object({
  questions: z
    .array(z.object({ body: questionBody, targets: z.array(z.uuid()).max(200).default([]) }))
    .min(1, "Füg mindestens eine Frage hinzu.")
    .max(50, "Ein Austausch hat höchstens 50 Fragen."),
  context: z
    .string()
    .trim()
    .max(4000, "Der Kontext darf höchstens 4.000 Zeichen haben.")
    .optional()
    .transform((value) => (value ? value : undefined)),
  /** Optional: without a deadline the exchange stays open until someone closes it. */
  deadline: z.iso
    .datetime({ offset: true, message: "Die Frist ist ungültig." })
    .refine((value) => Date.parse(value) > Date.now() + 60_000, "Die Frist muss in der Zukunft liegen.")
    .refine(
      (value) => Date.parse(value) < Date.now() + MAX_DAYS * 86_400_000,
      `Die Frist darf höchstens ${MAX_DAYS} Tage in der Zukunft liegen.`,
    )
    .optional(),
  parentRoundId: z.uuid().optional(),
});

/** Your answers, one per question. An empty body removes the answer to that question. */
export const saveAnswersSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.uuid(), body: z.string().trim().max(10000, "Eine Antwort darf höchstens 10.000 Zeichen haben.") }))
    .max(50),
  source: z.enum(["text", "voice"]).default("text"),
});

export const clarificationSchema = z.object({
  body: z.string().trim().min(3, "Schreib eine Rückfrage mit mindestens 3 Zeichen.").max(2000, "Die Rückfrage darf höchstens 2.000 Zeichen haben."),
  questionId: z.uuid().optional(),
});

export const clarificationAnswerSchema = z.object({
  answer: z.string().trim().min(1, "Schreib eine Antwort.").max(4000, "Die Antwort darf höchstens 4.000 Zeichen haben."),
});

export const closeRoundSchema = z.object({ status: z.literal("closed") });

export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type ResponseInput = z.infer<typeof responseSchema>;
export type CreateExchangeInput = z.input<typeof createExchangeSchema>;
