"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccessLink } from "@/components/organizations/access-link";
import { Button } from "@/components/ui/form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { apiFetch } from "@/lib/api/client";
import { orgRoleLabel, orgRoles, type OrgRole } from "@/lib/organizations/roles";

type Props = {
  organizationId: string;
  userId: string;
  name: string;
  role: OrgRole;
  /**
   * The organization created this account and it belongs to no other organization.
   * Only then are access links and password resets possible.
   */
  managed: boolean;
  /** The person has not set a password through their access link yet. */
  pending: boolean;
};

/** Owner actions per person: role, access link, password reset, remove, delete account. */
export function PersonActions({ organizationId, userId, name, role, managed, pending }: Props) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const base = `/api/organizations/${organizationId}/members/${userId}`;

  async function run<T>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }

  async function changeRole(next: OrgRole) {
    const data = await run(() => apiFetch(base, { method: "PATCH", body: { role: next } }));
    if (data) {
      setNotice(`${name} ist jetzt ${orgRoleLabel[next]}.`);
      router.refresh();
    }
  }

  async function newLink(resetPassword: boolean) {
    const data = await run(() => apiFetch<{ link: string }>(`${base}/link`, { method: "POST", body: { resetPassword } }));
    if (data) {
      setLink(data.link);
      if (resetPassword) setNotice(`Das bisherige Passwort von ${name} gilt nicht mehr.`);
      router.refresh();
    }
  }

  async function remove() {
    if (await run(() => apiFetch(base, { method: "DELETE" }))) router.refresh();
  }

  async function deleteAccount() {
    if (await run(() => apiFetch(`${base}/account`, { method: "DELETE" }))) router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`role-${userId}`} className="text-label text-ink">
            Rolle
          </label>
          <select
            id={`role-${userId}`}
            value={role}
            disabled={busy}
            onChange={(e) => changeRole(e.target.value as OrgRole)}
            className="min-h-11 rounded-md border border-border-strong bg-card px-3 text-body text-ink"
          >
            {orgRoles.map((r) => (
              <option key={r} value={r}>
                {orgRoleLabel[r]}
              </option>
            ))}
          </select>
        </div>
        {managed && pending ? (
          <Button variant="secondary" onClick={() => newLink(false)} disabled={busy} aria-label={`Neuen Zugangslink für ${name} erzeugen`}>
            Zugangslink erzeugen
          </Button>
        ) : managed ? (
          <ConfirmButton
            label="Passwort zurücksetzen"
            ariaLabel={`Passwort von ${name} zurücksetzen`}
            confirmLabel="Zurücksetzen bestätigen"
            warning={`Das bisherige Passwort von ${name} gilt danach nicht mehr. Du bekommst einen Zugangslink, mit dem ${name} ein neues festlegt.`}
            disabled={busy}
            onConfirm={() => newLink(true)}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <ConfirmButton
          label="Aus Organisation entfernen"
          ariaLabel={`${name} aus der Organisation entfernen`}
          confirmLabel="Entfernen bestätigen"
          warning={`${name} verliert den Zugang zur Organisation und zu allen ihren Teams. Das Konto bleibt bestehen.`}
          disabled={busy}
          onConfirm={remove}
        />
        {managed ? (
          <ConfirmButton
            label="Konto löschen"
            ariaLabel={`Konto von ${name} löschen`}
            confirmLabel="Konto endgültig löschen"
            warning={`Das Konto von ${name} wird mit allen Antworten gelöscht. Das lässt sich nicht rückgängig machen.`}
            disabled={busy}
            onConfirm={deleteAccount}
          />
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-body-sm text-danger-ink">
          {error}
        </p>
      ) : null}
      <p role="status" className="text-body-sm text-success-ink">
        {notice}
      </p>
      {link ? <AccessLink link={link} name={name} /> : null}
    </div>
  );
}
