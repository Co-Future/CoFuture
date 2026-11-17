import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/lib/db/server";

export type OrganizationSummary = { id: string; name: string; role: "admin" | "member" };

/** Cookie with the organization selected in the sidebar. Only a preference: membership is always checked. */
export const ORG_COOKIE = "cofuture_org";

/** All organizations of the signed-in user, by name. Deduplicated per request. */
export const getMyOrganizations = cache(async (userId: string): Promise<OrganizationSummary[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("organization_members").select("role, organizations(id, name)").eq("user_id", userId);
  return (data ?? [])
    .filter((m) => m.organizations)
    .map((m) => ({ id: m.organizations!.id, name: m.organizations!.name, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
});

/** The organization selected in the sidebar, else the first one, or null without any. */
export const getCurrentOrganization = cache(async (userId: string): Promise<OrganizationSummary | null> => {
  const [orgs, cookieStore] = await Promise.all([getMyOrganizations(userId), cookies()]);
  const selected = cookieStore.get(ORG_COOKIE)?.value;
  return orgs.find((o) => o.id === selected) ?? orgs[0] ?? null;
});

export const orgCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};
