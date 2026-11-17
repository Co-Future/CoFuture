"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { addMemberSchema } from "@/lib/validation/team";

export function AddMemberForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError(null);
    setSuccess(null);
    const parsed = addMemberSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setPending(true);
    const result = await apiFetch(`/api/teams/${teamId}/members`, { method: "POST", body: parsed.data });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    form.reset();
    setSuccess("Mitglied hinzugefügt.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Field
            id="member-email"
            name="email"
            type="email"
            label="E-Mail-Adresse"
            hint="Die Person braucht schon ein CoFuture-Konto."
            autoComplete="off"
            error={fieldError}
          />
        </div>
        <Button type="submit" disabled={pending} className="sm:mt-6">
          Mitglied hinzufügen
        </Button>
      </div>
      {formError ? <FormError>{formError}</FormError> : null}
      <p role="status" className="text-body-sm text-success-ink">
        {success}
      </p>
    </form>
  );
}
