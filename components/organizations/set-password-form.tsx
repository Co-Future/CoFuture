"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/db/client";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { newPasswordSchema, type NewPasswordInput } from "@/lib/validation/organization";

/** First login through a one-time access link: set your own password, then sign in. */
export function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<NewPasswordInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = newPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);

    const result = await apiFetch<{ email: string }>("/api/invites/accept", {
      method: "POST",
      body: { token, password: parsed.data.password },
    });
    if (!result.ok) {
      if (result.error.fields?.password) setErrors({ password: result.error.fields.password });
      else setFormError(result.error.message);
      setPending(false);
      return;
    }

    const supabase = createClient();
    // Drop any session of someone else on this device before signing in as the new person.
    await supabase.auth.signOut({ scope: "local" });
    const { error } = await supabase.auth.signInWithPassword({ email: result.data.email, password: parsed.data.password });
    if (error) {
      setFormError(`${authErrorMessage(error)} Dein Passwort ist gespeichert, melde dich über „Anmelden“ an.`);
      setPending(false);
      return;
    }
    router.replace("/app");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormError>{formError}</FormError> : null}
      <Field
        id="password"
        name="password"
        type="password"
        label="Neues Passwort"
        hint="Mindestens 8 Zeichen."
        autoComplete="new-password"
        error={errors.password}
      />
      <Field
        id="passwordRepeat"
        name="passwordRepeat"
        type="password"
        label="Passwort wiederholen"
        autoComplete="new-password"
        error={errors.passwordRepeat}
      />
      <Button type="submit" disabled={pending}>
        Passwort festlegen
      </Button>
    </form>
  );
}
