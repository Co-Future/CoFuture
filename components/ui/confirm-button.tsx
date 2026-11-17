"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/form";

type Props = {
  /** Button text before confirming, e.g. "Konto löschen". */
  label: string;
  /** Button text to confirm, e.g. "Löschen bestätigen". */
  confirmLabel: string;
  /** Shown while confirming: what will happen. */
  warning?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  onConfirm: () => Promise<void> | void;
};

/** Two-step button for actions that cannot be undone. */
export function ConfirmButton({ label, confirmLabel, warning, disabled, ariaLabel, onConfirm }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)} disabled={disabled} aria-label={ariaLabel}>
        {label}
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2">
      {warning ? <p className="text-body-sm text-danger-ink">{warning}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
          Abbrechen
        </Button>
        <Button onClick={confirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
