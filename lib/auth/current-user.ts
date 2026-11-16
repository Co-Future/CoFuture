import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/db/server";

export type CurrentUser = { id: string; displayName: string };

/**
 * The signed-in user, or a redirect to the login page. Verifies the session token.
 * Reads cookies, so call it inside a <Suspense> boundary. Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  if (!profile) redirect("/login");

  return { id: userId, displayName: profile.display_name };
});
