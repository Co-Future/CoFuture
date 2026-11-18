"use client";

import { Building2, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrgRoleBadge } from "@/components/organizations/org-role-badge";
import { Button } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { orgRoleHint, type OrgRole } from "@/lib/organizations/roles";

type Props = {
  id: string;
  organizationName: string;
  role: OrgRole;
  teamNames: string[];
  invitedBy: string | null;
  /** Already formatted on the server, e.g. "17.11.2026, 21:30 Uhr". */
  createdAt: string;
};

/** An open invitation to an organization. You only join when you accept it. */
export function InvitationCard({ id, organizationName, role, teamNames, invitedBy, createdAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(accept: boolean) {
    setBusy(true);
    setError(null);
    const result = accept
      ? await apiFetch(`/api/invitations/${id}/accept`, { method: "POST" })
      : await apiFetch(`/api/invitations/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <Building2 size={20} strokeWidth={1.75} aria-hidden className="text-ink-muted" />
        <span className="text-h3">{organizationName}</span>
        <OrgRoleBadge role={role} />
      </div>
      <p className="text-body-sm text-ink-muted">
        {invitedBy ? `Eingeladen von ${invitedBy}` : "Eingeladen"} am {createdAt}. {orgRoleHint[role]}
      </p>
      {teamNames.length > 0 ? (
        <p className="text-body-sm">
          <span className="text-ink-muted">Teams: </span>
          {teamNames.join(", ")}
        </p>
      ) : null}
      <p className="text-body-sm text-ink-muted">
        Erst wenn du annimmst, wirst du Mitglied. Die Owner sehen dann deine E-Mail-Adresse, alle anderen nur deinen
        Anzeigenamen.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => respond(true)} disabled={busy} aria-label={`Einladung von ${organizationName} annehmen`}>
          <Check size={20} strokeWidth={1.75} aria-hidden />
          Einladung annehmen
        </Button>
        <Button
          variant="secondary"
          onClick={() => respond(false)}
          disabled={busy}
          aria-label={`Einladung von ${organizationName} ablehnen`}
        >
          <X size={20} strokeWidth={1.75} aria-hidden />
          Einladung ablehnen
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-body-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
