import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Gib eine gültige E-Mail-Adresse ein."));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Gib dein Passwort ein."),
});

export const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Gib einen Anzeigenamen ein.")
    .max(80, "Der Anzeigename darf höchstens 80 Zeichen haben."),
  email,
  password: z
    .string()
    .min(8, "Das Passwort braucht mindestens 8 Zeichen.")
    .max(72, "Das Passwort darf höchstens 72 Zeichen haben."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** First message per field, for showing next to the inputs. */
export function fieldErrors<T>(error: z.ZodError<T>): FieldErrors<T> {
  const result: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof T | undefined;
    if (key !== undefined && result[key] === undefined) result[key] = issue.message;
  }
  return result;
}
