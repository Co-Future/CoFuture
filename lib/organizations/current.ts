import { cache } from "react";
import { createClient } from "@/lib/db/server";

export type CurrentOrganization = { id: string; name: string; role: "admin" | "member" };

/** The signed-in user's organization (MVP: at most one), or null. Deduplicated per request. */
export const getCurrentOrganization = cache(async (userId: string): Promise<CurrentOrganization | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.organizations) return null;
  return { id: data.organizations.id, name: data.organizations.name, role: data.role };
});
