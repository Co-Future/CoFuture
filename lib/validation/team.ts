import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, "Gib einen Teamnamen ein.").max(80, "Der Teamname darf höchstens 80 Zeichen haben."),
});

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Gib eine gültige E-Mail-Adresse ein.")),
});

export const uuidSchema = z.uuid();

/** Team inside an organization: pick a person from the organization by id. */
export const addOrgMemberSchema = z.object({ userId: z.uuid("Wähl eine Person aus.") });

export const addTeamMemberSchema = z.union([addOrgMemberSchema, addMemberSchema]);

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
