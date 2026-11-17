"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";

/**
 * Desktop: fixed sidebar on the left. Mobile: top bar with a menu button that opens the
 * same sidebar as a drawer. Closes on navigation and with Escape.
 */
export function SidebarFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-2 lg:hidden">
        <Link href="/app" aria-label="CoFuture Übersicht">
          <Logo fontSize={20} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="app-sidebar"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-sunken"
        >
          <Menu size={20} strokeWidth={1.75} aria-hidden />
          <span className="sr-only">Menü öffnen</span>
        </button>
      </div>

      {open ? <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" aria-hidden onClick={() => setOpen(false)} /> : null}

      <aside
        id="app-sidebar"
        aria-label="Hauptmenü"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-paper transition-transform motion-reduce:transition-none lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
          <Link href="/app" aria-label="CoFuture Übersicht">
            <Logo fontSize={22} />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-sunken lg:hidden"
          >
            <X size={20} strokeWidth={1.75} aria-hidden />
            <span className="sr-only">Menü schließen</span>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4">{children}</div>
      </aside>
    </>
  );
}
