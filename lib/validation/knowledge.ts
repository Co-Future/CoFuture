import { z } from "zod";

export const knowledgeSearchSchema = z.object({
  q: z.string().trim().min(2, "Gib mindestens 2 Zeichen ein.").max(200, "Die Suche darf höchstens 200 Zeichen haben."),
  team: z.uuid().optional(),
});

export const knowledgeQuestionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(5, "Stell eine Frage mit mindestens 5 Zeichen.")
    .max(300, "Die Frage darf höchstens 300 Zeichen haben."),
  team: z.uuid().optional(),
});
