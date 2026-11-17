import { CircleCheck, Clock, Lock } from "lucide-react";

type Status = "open" | "closed" | "decided";

const config = {
  open: { label: "Offen", Icon: Clock, className: "bg-primary-soft text-ink" },
  closed: { label: "Geschlossen", Icon: Lock, className: "bg-sunken text-ink-muted" },
  decided: { label: "Entschieden", Icon: CircleCheck, className: "bg-success-soft text-success-ink" },
} as const;

export function StatusBadge({ status }: { status: Status }) {
  const { label, Icon, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-body-sm ${className}`}>
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      {label}
    </span>
  );
}
