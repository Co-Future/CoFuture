"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/form";

/** Shows a freshly issued one-time access link once, with a copy button. */
export function AccessLink({ link, name }: { link: string; name: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-sunken p-4">
      <p className="text-label text-ink">Zugangslink für {name}</p>
      <input
        readOnly
        value={link}
        aria-label={`Zugangslink für ${name}`}
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-11 w-full rounded-md border border-border-strong bg-card px-3 font-mono text-body-sm text-ink"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? <Check size={20} strokeWidth={1.75} aria-hidden /> : <Copy size={20} strokeWidth={1.75} aria-hidden />}
          {copied ? "Kopiert" : "Link kopieren"}
        </Button>
        <p role="status" className="sr-only">
          {copied ? "Link kopiert" : ""}
        </p>
      </div>
      <p className="text-body-sm text-ink-muted">
        Schick den Link an {name}, zum Beispiel per Chat. Er gilt 72 Stunden und nur einmal. Damit legt {name} das eigene
        Passwort fest. Der Link wird nur jetzt angezeigt.
      </p>
    </div>
  );
}
