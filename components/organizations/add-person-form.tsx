"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AccessLink } from "@/components/organizations/access-link";
import { Button, Field, FormError } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { orgRoleHint, orgRoleLabel, orgRoles } from "@/lib/organizations/roles";
import { addPersonSchema, type AddPersonInput } from "@/lib/validation/organization";

type Props = { organizationId: string; teams: { id: string; name: string }[] };

/** Owners add a person: the account is created right away and a one-time access link is shown. */
export function AddPersonForm({ organizationId, teams }: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<AddPersonInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ link: string; name: string } | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError(null);
    setIssued(null);
    setJoined(null);
    const parsed = addPersonSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const result = await apiFetch<{ link: string | null }>(`/api/organizations/${organizationId}/members`, {
      method: "POST",
      body: parsed.data,
    });
    setPending(false);
    if (!result.ok) {
      if (result.error.fields) setErrors(result.error.fields as FieldErrors<AddPersonInput>);
      else setFormError(result.error.message);
      return;
    }
    form.reset();
    if (result.data.link) setIssued({ link: result.data.link, name: parsed.data.displayName });
    else setJoined(`${parsed.data.email} hat schon ein CoFuture-Konto und ist jetzt in der Organisation. Die Person meldet sich wie gewohnt an.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError ? <FormError>{formError}</FormError> : null}
        <Field
          id="person-name"
          name="displayName"
          label="Anzeigename"
          hint="Ein Pseudonym reicht. Klarnamen nur mit Zustimmung."
          autoComplete="off"
          maxLength={80}
          error={errors.displayName}
        />
        <Field
          id="person-email"
          name="email"
          type="email"
          label="E-Mail-Adresse"
          hint="Damit meldet sich die Person später an. Die Adresse sehen nur Owner."
          autoComplete="off"
          error={errors.email}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="person-role" className="text-label text-ink">
            Rolle
          </label>
          <select
            id="person-role"
            name="role"
            defaultValue="member"
            aria-describedby="person-role-hint"
            className="min-h-11 rounded-md border border-border-strong bg-card px-3 text-body text-ink"
          >
            {orgRoles.map((r) => (
              <option key={r} value={r}>
                {orgRoleLabel[r]}
              </option>
            ))}
          </select>
          <p id="person-role-hint" className="text-body-sm text-ink-muted">
            {orgRoleLabel.guest}: {orgRoleHint.guest}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="person-team" className="text-label text-ink">
            Team (optional)
          </label>
          <select
            id="person-team"
            name="teamId"
            defaultValue=""
            aria-describedby={errors.teamId ? "person-team-error" : undefined}
            className="min-h-11 rounded-md border border-border-strong bg-card px-3 text-body text-ink"
          >
            <option value="">Kein Team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          {errors.teamId ? (
            <p id="person-team-error" className="text-body-sm text-danger-ink">
              {errors.teamId}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={pending}>
          Person hinzufügen
        </Button>
      </form>
      {issued ? <AccessLink link={issued.link} name={issued.name} /> : null}
      <p role="status" className="text-body-sm text-success-ink">
        {joined}
      </p>
    </div>
  );
}
