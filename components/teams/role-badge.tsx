import { Crown, User } from "lucide-react";

export function RoleBadge({ role }: { role: "lead" | "member" }) {
  const Icon = role === "lead" ? Crown : User;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-body-sm text-ink-muted">
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      {role === "lead" ? "Leitung" : "Mitglied"}
    </span>
  );
}
