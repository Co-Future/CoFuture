"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AccessLink } from "@/components/organizations/access-link";
import { Button, Field, FormError } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { orgRoleHint, orgRoleLabel, orgRoles } from "@/lib/organizations/roles";
import { addPersonSchema, type AddPersonInput, type AddPersonResult } from "@/lib/validation/organization";

type Props = { organizationId: string; teams: { id: string; name: string }[] };

/**
 * Owners add a person. Without an account, it is created right away and a one-time access link is
 * shown. With an existing account, the person gets an invitation and joins once they accept it.
 */
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
    const data = new FormData(form);
    const parsed = addPersonSchema.safeParse({
      displayName: data.get("displayName"),
      email: data.get("email"),
      role: data.get("role"),
      teamIds: data.getAll("teamIds"),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const result = await apiFetch<AddPersonResult>(`/api/organizations/${organizationId}/members`, {
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
    if (result.data.status === "created") setIssued({ link: result.data.link, name: parsed.data.displayName });
    else
      setJoined(
        `${parsed.data.email} hat schon ein CoFuture-Konto und ist jetzt eingeladen. Nach dem Anmelden sieht die Person die Einladung und tritt bei, sobald sie annimmt.`,
      );
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
          hint="Ein Pseudonym reicht. Klarnamen nur mit Zustimmung. Wer schon ein Konto hat, behält den eigenen Namen."
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
        {teams.length > 0 ? (
          <fieldset className="flex flex-col gap-1" aria-describedby={errors.teamIds ? "person-teams-error" : "person-teams-hint"}>
            <legend className="text-label text-ink">Teams (optional)</legend>
            <ul className="mt-1 flex flex-col">
              {teams.map((team) => (
                <li key={team.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink">
                    <input type="checkbox" name="teamIds" value={team.id} className="size-5 accent-primary" />
                    {team.name}
                  </label>
                </li>
              ))}
            </ul>
            {errors.teamIds ? (
              <p id="person-teams-error" className="text-body-sm text-danger-ink">
                {errors.teamIds}
              </p>
            ) : (
              <p id="person-teams-hint" className="text-body-sm text-ink-muted">
                Bei einer Einladung kommt die Person erst beim Annehmen in die Teams.
              </p>
            )}
          </fieldset>
        ) : null}
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
