import { ShieldCheck, User, UserRound } from "lucide-react";
import { orgRoleLabel, type OrgRole } from "@/lib/organizations/roles";

const icons = { owner: ShieldCheck, member: User, guest: UserRound } as const;

export function OrgRoleBadge({ role }: { role: OrgRole }) {
  const Icon = icons[role];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-body-sm text-ink-muted">
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      {orgRoleLabel[role]}
    </span>
  );
}
