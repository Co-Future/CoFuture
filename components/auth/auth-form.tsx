"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError } from "@/components/ui/form";
import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/db/client";
import { apiFetch } from "@/lib/api/client";
import { fieldErrors, loginSchema, type FieldErrors } from "@/lib/validation/auth";
import { organizationSignupSchema, type OrganizationSignupInput } from "@/lib/validation/organization";

/**
 * Login, or sign-up that creates a new organization (the person becomes its owner).
 * Talks to Supabase Auth from the browser; the session lands in cookies.
 * Everyone else gets an account from their admin and comes in through a one-time access link.
 */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<OrganizationSignupInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setFormError(null);

    const parsed = isSignup ? organizationSignupSchema.safeParse(values) : loginSchema.safeParse(values);
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
    if ("organizationName" in parsed.data) {
      const org = await apiFetch("/api/organizations", { method: "POST", body: { name: parsed.data.organizationName } });
      // The account exists either way. Without an organization, the overview offers to create one.
      if (!org.ok) {
        router.replace("/app");
        return;
      }
    }
    router.replace("/app");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormError>{formError}</FormError> : null}
      {isSignup ? (
        <Field
          id="organizationName"
          name="organizationName"
          label="Name der Organisation"
          hint="Zum Beispiel deine Firma oder dein Verein."
          autoComplete="organization"
          maxLength={80}
          error={errors.organizationName}
        />
      ) : null}
      {isSignup ? (
        <Field
          id="displayName"
          name="displayName"
          label="Anzeigename"
          hint="So sehen dich die anderen in deiner Organisation. Antworten bleiben pseudonym."
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
        {isSignup ? "Organisation anlegen" : "Anmelden"}
      </Button>
      {isSignup ? (
        <p className="text-body-sm text-ink-muted">
          Du hast schon ein Konto?{" "}
          <Link href="/login" className="font-semibold text-primary underline">
            Anmelden
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-line pt-4 text-body-sm text-ink-muted">
          <p>Noch kein Zugang? Deine Organisation schickt dir einen Zugangslink. Damit legst du dein Passwort fest.</p>
          <p>
            Neu bei CoFuture?{" "}
            <Link href="/registrieren" className="font-semibold text-primary underline">
              Organisation anlegen
            </Link>
          </p>
        </div>
      )}
    </form>
  );
}
