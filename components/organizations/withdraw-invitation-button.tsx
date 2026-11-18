"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { apiFetch } from "@/lib/api/client";

/** Owners withdraw an open invitation. The person then no longer sees it. */
export function WithdrawInvitationButton({ organizationId, invitationId, name }: { organizationId: string; invitationId: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setError(null);
    const result = await apiFetch(`/api/organizations/${organizationId}/invitations/${invitationId}`, { method: "DELETE" });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <ConfirmButton
        label="Einladung zurückziehen"
        ariaLabel={`Einladung an ${name} zurückziehen`}
        confirmLabel="Zurückziehen bestätigen"
        warning={`${name} sieht die Einladung danach nicht mehr. Du kannst die Person später neu einladen.`}
        onConfirm={withdraw}
      />
      {error ? (
        <p role="alert" className="text-body-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
