"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, FormError } from "@/components/ui/form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { apiFetch } from "@/lib/api/client";

type Props = {
  teamId: string;
  /** Team members except the caller. */
  others: { id: string; name: string }[];
};

/** Lead or owner area: hand the team over, or delete it once nobody else is in it. */
export function TeamDangerZone({ teamId, others }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
    const result = await apiFetch(`/api/teams/${teamId}/transfer`, { method: "POST", body: { userId } });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  async function remove() {
    setError(null);
    const result = await apiFetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <section aria-labelledby="team-danger-heading" className="flex flex-col gap-6 rounded-lg border border-line bg-card p-4">
      <h2 id="team-danger-heading" className="text-h3">
        Übergeben und löschen
      </h2>
      {error ? <FormError>{error}</FormError> : null}

      <form onSubmit={transfer} className="flex flex-col gap-2">
        <label htmlFor="team-transfer" className="text-label text-ink">
          Team übergeben
        </label>
        <p className="text-body-sm text-ink-muted">Die Person wird Leitung, du wirst Mitglied.</p>
        {others.length > 0 ? (
          <div className="flex flex-col gap-2">
            <select
              id="team-transfer"
              name="userId"
              defaultValue=""
              className="min-h-11 rounded-md border border-border-strong bg-card px-3 text-body text-ink"
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
              Team übergeben
            </Button>
          </div>
        ) : (
          <p className="text-body-sm text-ink-muted">Füg zuerst jemanden hinzu, an den du übergeben kannst.</p>
        )}
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-label text-ink">Team löschen</p>
        {others.length > 0 ? (
          <p className="text-body-sm text-ink-muted">
            Entferne zuerst alle anderen Mitglieder. Noch {others.length === 1 ? "1 Person" : `${others.length} Personen`} im Team.
          </p>
        ) : (
          <ConfirmButton
            label="Team löschen"
            confirmLabel="Endgültig löschen"
            warning="Alle Runden und Antworten des Teams werden gelöscht. Das lässt sich nicht rückgängig machen."
            onConfirm={remove}
          />
        )}
      </div>
    </section>
  );
}
