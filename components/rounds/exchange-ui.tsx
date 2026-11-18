import { CircleCheck, Users } from "lucide-react";
import type { ReactNode } from "react";

/** Shared building blocks for exchanges: numbered questions, people, answers. Server and client safe. */

export function QuestionNumber({ n }: { n: number }) {
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-body-sm font-semibold text-primary"
      aria-hidden
    >
      {n}
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-sunken font-semibold text-ink ${
        size === "sm" ? "h-6 w-6 text-caption" : "h-8 w-8 text-body-sm"
      }`}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function PersonChip({ name, suffix }: { name: string; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-card py-0.5 pr-3 pl-1 text-body-sm text-ink">
      <Avatar name={name} size="sm" />
      {name}
      {suffix ? <span className="text-ink-muted">{suffix}</span> : null}
    </span>
  );
}

/** Who a question is for: everyone, or the named people. */
export function Audience({ names, extra }: { names: string[]; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {names.length === 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-3 py-0.5 text-body-sm text-ink-muted">
          <Users size={16} strokeWidth={1.75} aria-hidden />
          Alle im Team
        </span>
      ) : (
        names.map((n) => <PersonChip key={n} name={n} />)
      )}
      {extra}
    </div>
  );
}

/** An answer directly under its question, on a green surface so question and answer read as a pair. */
export function AnswerBox({ label = "Antwort", children }: { label?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-success-soft p-4">
      <p className="mb-1 inline-flex items-center gap-1 text-label text-success-ink">
        <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
        {label}
      </p>
      <div className="text-body text-ink">{children}</div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-card p-5 shadow-card ${className}`}>{children}</div>;
}
