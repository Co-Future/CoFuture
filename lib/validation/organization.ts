import { z } from "zod";
import { signupSchema } from "./auth";

const orgName = z
  .string()
  .trim()
  .min(1, "Gib einen Namen für die Organisation ein.")
  .max(80, "Der Name darf höchstens 80 Zeichen haben.");

export const createOrganizationSchema = z.object({ name: orgName });

/** Sign-up that creates a new organization: the person becomes its admin. */
export const organizationSignupSchema = signupSchema.extend({ organizationName: orgName });

export const addPersonSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Gib einen Anzeigenamen ein.")
    .max(80, "Der Anzeigename darf höchstens 80 Zeichen haben."),
  email: z.string().trim().toLowerCase().pipe(z.email("Gib eine gültige E-Mail-Adresse ein.")),
  role: z.enum(["owner", "member", "guest"]).default("member"),
  // Empty string from the "no team" option of the select.
  teamId: z.union([z.uuid(), z.literal("")]).optional().transform((v) => v || undefined),
});

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Das Passwort braucht mindestens 8 Zeichen.")
      .max(72, "Das Passwort darf höchstens 72 Zeichen haben."),
    passwordRepeat: z.string(),
  })
  .refine((v) => v.password === v.passwordRepeat, {
    path: ["passwordRepeat"],
    message: "Die Passwörter stimmen nicht überein.",
  });

/** Access tokens are 32 random bytes in base64url (43 characters). */
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const acceptInviteSchema = z.object({
  token: inviteTokenSchema,
  password: newPasswordSchema.shape.password,
});

export const setRoleSchema = z.object({ role: z.enum(["owner", "member", "guest"]) });

export type OrganizationSignupInput = z.infer<typeof organizationSignupSchema>;
export type AddPersonInput = z.input<typeof addPersonSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
