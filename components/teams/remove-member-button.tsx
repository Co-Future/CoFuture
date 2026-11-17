"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";

type Props = { teamId: string; userId: string; name: string; isSelf: boolean };

/** Remove a member (leads) or leave the team (self). Asks once before acting. */
export function RemoveMemberButton({ teamId, userId, name, isSelf }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    const result = await apiFetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      setConfirming(false);
      return;
    }
    if (isSelf) router.push("/app");
    router.refresh();
  }

  const action = isSelf ? "Team verlassen" : "Entfernen";
  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={remove} disabled={pending} aria-label={isSelf ? "Team wirklich verlassen" : `${name} wirklich entfernen`}>
            {isSelf ? "Verlassen bestätigen" : "Entfernen bestätigen"}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)} aria-label={isSelf ? action : `${name} entfernen`}>
          {action}
        </Button>
      )}
      {error ? (
        <p role="alert" className="max-w-[320px] text-right text-body-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
