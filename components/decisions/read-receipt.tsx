"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";

type Props = { decisionId: string; hasRead: boolean; readCount: number; memberCount: number };

/** Confirm reading for yourself. Everyone sees only the count, never who has not read. */
export function ReadReceipt({ decisionId, hasRead, readCount, memberCount }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    const result = await apiFetch(`/api/decisions/${decisionId}/read`, { method: "POST" });
    setPending(false);
    if (!result.ok) setError(result.error.message);
    else router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {hasRead ? (
        <span className="inline-flex items-center gap-1.5 text-body-sm text-success-ink">
          <CircleCheck aria-hidden size={20} strokeWidth={1.75} />
          Du hast den Beschluss gelesen
        </span>
      ) : (
        <Button type="button" onClick={confirm} disabled={pending}>
          <CircleCheck aria-hidden size={20} strokeWidth={1.75} />
          {pending ? "Wird gespeichert …" : "Gelesen bestätigen"}
        </Button>
      )}
      <span className="text-body-sm text-ink-muted">
        {readCount} von {memberCount} im Team haben gelesen
      </span>
      {error ? (
        <p role="alert" className="w-full text-body-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
