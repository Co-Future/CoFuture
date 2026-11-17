"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { addMemberSchema, addOrgMemberSchema } from "@/lib/validation/team";

type Props = {
  teamId: string;
  /** People from the team's organization who are not in the team yet. Undefined for teams without organization. */
  candidates?: { id: string; name: string }[];
};

export function AddMemberForm({ teamId, candidates }: Props) {
  const router = useRouter();
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fromOrganization = candidates !== undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError(null);
    setSuccess(null);
    const values = Object.fromEntries(new FormData(form));
    const parsed = fromOrganization ? addOrgMemberSchema.safeParse(values) : addMemberSchema.safeParse(values);
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

  if (fromOrganization && candidates.length === 0) {
    return (
      <p className="text-body-sm text-ink-muted">
        Alle Personen deiner Organisation sind schon im Team. Neue Personen legst du unter{" "}
        <Link href="/app/organisation" className="font-semibold text-primary underline">
          Organisation
        </Link>{" "}
        an.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {fromOrganization ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="member-user" className="text-label text-ink">
              Person aus deiner Organisation
            </label>
            <select
              id="member-user"
              name="userId"
              defaultValue=""
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "member-user-error" : "member-user-hint"}
              className={`min-h-11 rounded-md border bg-card px-3 text-body text-ink ${fieldError ? "border-danger" : "border-border-strong"}`}
            >
              <option value="" disabled>
                Person wählen
              </option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldError ? (
              <p id="member-user-error" className="text-body-sm text-danger-ink">
                {fieldError}
              </p>
            ) : (
              <p id="member-user-hint" className="text-body-sm text-ink-muted">
                Wer noch fehlt, legst du unter Organisation an.
              </p>
            )}
          </div>
        ) : (
          <Field
            id="member-email"
            name="email"
            type="email"
            label="E-Mail-Adresse"
            hint="Die Person braucht schon ein CoFuture-Konto."
            autoComplete="off"
            error={fieldError}
          />
        )}
        <Button type="submit" disabled={pending}>
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
