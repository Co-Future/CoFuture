import { cache } from "react";
import { createClient } from "@/lib/db/server";
import type { OrgRole } from "@/lib/organizations/roles";

export type MyInvitation = {
  id: string;
  organizationName: string;
  role: OrgRole;
  teamNames: string[];
  invitedBy: string | null;
  createdAt: string;
};

/** Open invitations of the signed-in person (not yet a member). Deduplicated per request. */
export const getMyInvitations = cache(async (): Promise<MyInvitation[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_organization_invitations");
  return (data ?? []).map((i) => ({
    id: i.id,
    organizationName: i.organization_name,
    role: i.role,
    teamNames: i.team_names ?? [],
    invitedBy: i.invited_by_name ?? null,
    createdAt: i.created_at,
  }));
});
