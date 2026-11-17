"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError } from "@/components/ui/form";
import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/db/client";
import { fieldErrors, loginSchema, signupSchema, type FieldErrors, type SignupInput } from "@/lib/validation/auth";

/** Login and sign-up form. Talks to Supabase Auth from the browser; the session lands in cookies. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<SignupInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setFormError(null);

    const parsed = isSignup ? signupSchema.safeParse(values) : loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);

    const supabase = createClient();
    const { data, error } =
      "displayName" in parsed.data
        ? await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: { data: { display_name: parsed.data.displayName } },
          })
        : await supabase.auth.signInWithPassword(parsed.data);

    if (error || !data.session) {
      setFormError(authErrorMessage(error ?? {}));
      setPending(false);
      return;
    }
    router.replace("/app");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormError>{formError}</FormError> : null}
      {isSignup ? (
        <Field
          id="displayName"
          name="displayName"
          label="Anzeigename"
          hint="So sehen dich die Mitglieder deiner Teams. Antworten bleiben pseudonym."
          autoComplete="name"
          error={errors.displayName}
        />
      ) : null}
      <Field id="email" name="email" type="email" label="E-Mail-Adresse" autoComplete="email" error={errors.email} />
      <Field
        id="password"
        name="password"
        type="password"
        label="Passwort"
        hint={isSignup ? "Mindestens 8 Zeichen." : undefined}
        autoComplete={isSignup ? "new-password" : "current-password"}
        error={errors.password}
      />
      <Button type="submit" disabled={pending}>
        {isSignup ? "Konto anlegen" : "Anmelden"}
      </Button>
      <p className="text-body-sm text-ink-muted">
        {isSignup ? "Du hast schon ein Konto? " : "Noch kein Konto? "}
        <Link href={isSignup ? "/login" : "/registrieren"} className="font-semibold text-primary underline">
          {isSignup ? "Anmelden" : "Konto anlegen"}
        </Link>
      </p>
    </form>
  );
}
