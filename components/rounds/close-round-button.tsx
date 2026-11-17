"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";

export function CloseRoundButton({ roundId }: { roundId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setPending(true);
    setError(null);
    const result = await apiFetch(`/api/rounds/${roundId}`, { method: "PATCH", body: { status: "closed" } });
    setPending(false);
    setConfirming(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-sm text-ink-muted">Danach kann niemand mehr antworten.</span>
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={close} disabled={pending}>
            Schließen bestätigen
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Runde jetzt schließen
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-body-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
