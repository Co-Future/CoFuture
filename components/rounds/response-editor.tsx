"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, FormError, TextAreaField } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { responseSchema } from "@/lib/validation/round";

type Props = { roundId: string; initialBody: string | null; pseudonym: string | null };

export function ResponseEditor({ roundId, initialBody, pseudonym }: Props) {
  const router = useRouter();
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setStatus(null);
    const parsed = responseSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setPending(true);
    const result = await apiFetch<{ pseudonym: string }>(`/api/rounds/${roundId}/response`, {
      method: "PUT",
      body: parsed.data,
    });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    setStatus(`Antwort gespeichert. Du erscheinst als ${result.data.pseudonym}.`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      {formError ? <FormError>{formError}</FormError> : null}
      <TextAreaField
        id="response-body"
        name="body"
        label="Antwort als Text"
        rows={6}
        maxLength={10000}
        defaultValue={initialBody ?? ""}
        hint={
          pseudonym
            ? `Du erscheinst als ${pseudonym}. Bis zur Frist kannst du deine Antwort ändern.`
            : "Die anderen sehen deine Antwort erst nach der Frist und nur mit Pseudonym."
        }
        error={fieldError}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {initialBody ? "Antwort aktualisieren" : "Antwort speichern"}
        </Button>
        <p role="status" className="text-body-sm text-success-ink">
          {status}
        </p>
      </div>
    </form>
  );
}
