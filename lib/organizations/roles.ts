export type OrgRole = "owner" | "member" | "guest";

export const orgRoles: OrgRole[] = ["owner", "member", "guest"];

export const orgRoleLabel: Record<OrgRole, string> = {
  owner: "Owner",
  member: "Mitglied",
  guest: "Gast",
};

export const orgRoleHint: Record<OrgRole, string> = {
  owner: "Verwaltet Personen, Rollen und Zugangslinks. Kann die Organisation löschen.",
  member: "Arbeitet in Teams, legt Teams und Runden an.",
  guest: "Sieht nur die Teams, in die er eingeladen ist. Antwortet auf Runden, startet keine.",
};
