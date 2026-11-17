"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccessLink } from "@/components/organizations/access-link";
import { Button } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";

type Props = { organizationId: string; userId: string; name: string };

/** Admin actions per person: issue a new access link (also after a forgotten password) or remove. */
export function PersonActions({ organizationId, userId, name }: Props) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/organizations/${organizationId}/members/${userId}`;

  async function newLink() {
    setPending(true);
    setError(null);
    const result = await apiFetch<{ link: string }>(`${base}/link`, { method: "POST" });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setLink(result.data.link);
    router.refresh();
  }

  async function remove() {
    setPending(true);
    setError(null);
    const result = await apiFetch(base, { method: "DELETE" });
    setPending(false);
    setConfirming(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={newLink} disabled={pending} aria-label={`Neuen Zugangslink für ${name} erzeugen`}>
          Zugangslink erzeugen
        </Button>
        {confirming ? (
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Abbrechen
            </Button>
            <Button onClick={remove} disabled={pending} aria-label={`${name} wirklich entfernen`}>
              Entfernen bestätigen
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={pending} aria-label={`${name} entfernen`}>
            Entfernen
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-body-sm text-danger-ink">
          {error}
        </p>
      ) : null}
      {link ? <AccessLink link={link} name={name} /> : null}
    </div>
  );
}
