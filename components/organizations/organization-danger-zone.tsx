"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError } from "@/components/ui/form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { apiFetch } from "@/lib/api/client";

type Props = {
  organizationId: string;
  organizationName: string;
  /** Everyone except the caller. */
  others: { id: string; name: string }[];
};

/** Owner area: hand the organization over, or delete it once nobody else is in it. */
export function OrganizationDangerZone({ organizationId, organizationName, others }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userId = String(new FormData(event.currentTarget).get("userId") ?? "");
    if (!userId) {
      setError("Wähl eine Person aus.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await apiFetch(`/api/organizations/${organizationId}/transfer`, { method: "POST", body: { userId } });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  async function remove() {
    setError(null);
    const result = await apiFetch(`/api/organizations/${organizationId}`, { method: "DELETE" });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <section aria-labelledby="org-danger-heading" className="flex flex-col gap-6 rounded-lg border border-line bg-card p-4">
      <h2 id="org-danger-heading" className="text-h3">
        Übergeben und löschen
      </h2>
      {error ? <FormError>{error}</FormError> : null}

      <form onSubmit={transfer} className="flex flex-col gap-2">
        <label htmlFor="org-transfer" className="text-label text-ink">
          Organisation übergeben
        </label>
        <p className="text-body-sm text-ink-muted">Die Person wird Owner, du wirst Mitglied.</p>
        {others.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              id="org-transfer"
              name="userId"
              defaultValue=""
              className="min-h-11 flex-1 rounded-md border border-border-strong bg-card px-3 text-body text-ink"
            >
              <option value="" disabled>
                Person wählen
              </option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" disabled={busy}>
              Organisation übergeben
            </Button>
          </div>
        ) : (
          <p className="text-body-sm text-ink-muted">Es gibt noch niemanden, an den du übergeben kannst.</p>
        )}
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-label text-ink">Organisation löschen</p>
        {others.length > 0 ? (
          <p className="text-body-sm text-ink-muted">
            Entferne zuerst alle anderen Personen. Noch {others.length === 1 ? "1 Person" : `${others.length} Personen`} in der
            Organisation.
          </p>
        ) : (
          <>
            <p className="text-body-sm text-ink-muted">
              Alle Teams, Austausche und Antworten der Organisation werden gelöscht. Gib zur Bestätigung den Namen ein.
            </p>
            <Field
              id="org-delete-name"
              label={`Name der Organisation: ${organizationName}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
            <ConfirmButton
              label="Organisation löschen"
              confirmLabel="Endgültig löschen"
              warning="Das lässt sich nicht rückgängig machen."
              disabled={typed.trim() !== organizationName}
              onConfirm={remove}
            />
          </>
        )}
      </div>
    </section>
  );
}
