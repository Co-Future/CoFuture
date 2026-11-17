"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError, TextAreaField } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { createRoundSchema, type CreateRoundInput } from "@/lib/validation/round";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";

type Props = {
  teamId: string;
  /** Follow-up round: the closed origin round, and an optional prefilled question. */
  parentRoundId?: string;
  defaultQuestion?: string;
};

export function CreateRoundForm({ teamId, parentRoundId, defaultQuestion }: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<CreateRoundInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    // datetime-local has no time zone: interpret it in the browser's local time.
    const local = String(form.get("deadline") ?? "");
    const values = {
      question: form.get("question"),
      context: form.get("context"),
      deadline: local ? new Date(local).toISOString() : "",
      parentRoundId,
    };
    const parsed = createRoundSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const result = await apiFetch<{ id: string }>(`/api/teams/${teamId}/rounds`, { method: "POST", body: parsed.data });
    if (!result.ok) {
      setFormError(result.error.message);
      setPending(false);
      return;
    }
    // Next keeps this page alive (Activity) after navigating away: start fresh for the next visit.
    formElement.reset();
    setPending(false);
    router.push(`/app/runden/${result.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-[680px] flex-col gap-5">
      {formError ? <FormError>{formError}</FormError> : null}
      <TextAreaField
        id="question"
        name="question"
        label="Frage"
        rows={2}
        maxLength={500}
        defaultValue={defaultQuestion}
        hint="Eine klare Frage, auf die alle antworten können. Nach der ersten Antwort lässt sie sich nicht mehr ändern."
        error={errors.question}
      />
      <TextAreaField
        id="context"
        name="context"
        label="Kontext (optional)"
        rows={5}
        maxLength={4000}
        hint="Hintergrund, Optionen oder Rahmenbedingungen, die alle kennen sollten."
        error={errors.context}
      />
      <Field
        id="deadline"
        name="deadline"
        type="datetime-local"
        label="Frist"
        hint="Bis dahin kann jede Person antworten. Danach schließt die Runde automatisch."
        error={errors.deadline}
      />
      <p className="text-body-sm text-ink-muted">Antworten erscheinen für alle nur mit Pseudonym (A01, A02 …).</p>
      <div>
        <Button type="submit" disabled={pending}>
          Runde starten
        </Button>
      </div>
    </form>
  );
}
