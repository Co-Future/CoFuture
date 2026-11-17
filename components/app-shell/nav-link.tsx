"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  href: string;
  Icon?: LucideIcon;
  /** Small colored dot instead of an icon (teams). Pass a token class like "bg-cat-blau". */
  dotClass?: string;
  /** Match only the exact path (for /app), not its children. */
  exact?: boolean;
  children: ReactNode;
  trailing?: ReactNode;
};

/** Sidebar link with an active state that does not rely on color alone (weight + marker + aria-current). */
export function NavLink({ href, Icon, dotClass, exact, children, trailing }: Props) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-body ${
        active ? "bg-primary-soft font-semibold text-ink" : "text-ink-muted hover:bg-sunken hover:text-ink"
      }`}
    >
      {Icon ? <Icon size={20} strokeWidth={1.75} aria-hidden /> : null}
      {dotClass ? <span className={`ml-1.5 size-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden /> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Link>
  );
}
