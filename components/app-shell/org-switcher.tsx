"use client";

import { Building2, Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/client";

type Org = { id: string; name: string; role: "admin" | "member" };

/** Organization menu at the top of the sidebar: the only place to switch organizations. */
export function OrgSwitcher({ organizations, currentId }: { organizations: Org[]; currentId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = organizations.find((o) => o.id === currentId) ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function switchTo(id: string) {
    setError(null);
    if (id === currentId) {
      setOpen(false);
      return;
    }
    const result = await apiFetch("/api/organizations/current", { method: "POST", body: { organizationId: id } });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    router.push("/app");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="org-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-line bg-card px-3 py-2 text-left shadow-card hover:border-border-strong"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-ink">
          <Building2 size={20} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-caption text-ink-muted">Organisation</span>
          <span className="block truncate text-body font-semibold">{current?.name ?? "Keine Organisation"}</span>
        </span>
        <ChevronsUpDown size={20} strokeWidth={1.75} aria-hidden className="text-ink-muted" />
      </button>

      {open ? (
        <div
          id="org-menu"
          className="absolute inset-x-0 top-full z-30 mt-2 rounded-lg border border-line bg-card p-2 shadow-overlay"
        >
          {organizations.length > 0 ? (
            <>
              <p className="px-2 pt-1 pb-2 text-caption text-ink-muted">Organisation wechseln</p>
              <ul className="flex flex-col gap-1">
                {organizations.map((org) => {
                  const isCurrent = org.id === currentId;
                  return (
                    <li key={org.id}>
                      <button
                        type="button"
                        onClick={() => switchTo(org.id)}
                        aria-current={isCurrent ? "true" : undefined}
                        className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-body hover:bg-sunken"
                      >
                        <span className="min-w-0 flex-1 truncate">{org.name}</span>
                        <span className="text-caption text-ink-muted">{org.role === "admin" ? "Admin" : "Mitglied"}</span>
                        {isCurrent ? (
                          <Check size={16} strokeWidth={1.75} aria-label="ausgewählt" className="text-primary" />
                        ) : (
                          <span className="size-4" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <hr className="my-2 border-line" />
            </>
          ) : null}
          <div className="flex flex-col gap-1">
            {current ? (
              <Link
                href="/app/organisation"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-2 rounded-md px-2 text-body hover:bg-sunken"
              >
                <Settings size={20} strokeWidth={1.75} aria-hidden />
                {current.role === "admin" ? "Organisation verwalten" : "Organisation ansehen"}
              </Link>
            ) : null}
            <Link
              href="/app/organisation/neu"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-2 rounded-md px-2 text-body hover:bg-sunken"
            >
              <Plus size={20} strokeWidth={1.75} aria-hidden />
              Organisation anlegen
            </Link>
          </div>
          {error ? (
            <p role="alert" className="px-2 pt-2 text-body-sm text-danger-ink">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
