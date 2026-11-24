import { z } from "zod";

export const knowledgeSearchSchema = z.object({
  q: z.string().trim().min(2, "Gib mindestens 2 Zeichen ein.").max(200, "Die Suche darf höchstens 200 Zeichen haben."),
  team: z.uuid().optional(),
});
