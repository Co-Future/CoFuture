"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { createTeamSchema } from "@/lib/validation/team";

export function CreateTeamForm() {
  const router = useRouter();
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = createTeamSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setPending(true);
    const result = await apiFetch<{ id: string }>("/api/teams", { method: "POST", body: parsed.data });
    if (!result.ok) {
      setFormError(result.error.message);
      setPending(false);
      return;
    }
    router.push(`/app/teams/${result.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-[680px] flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Field id="team-name" name="name" label="Name des neuen Teams" maxLength={80} error={fieldError} />
      </div>
      <Button type="submit" disabled={pending} className="sm:mt-6">
        Team anlegen
      </Button>
      {formError ? <FormError>{formError}</FormError> : null}
    </form>
  );
}
