// Server only: uses node:crypto and the admin client.
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/** One-time access tokens. Only the SHA-256 hash is stored; the token itself lives in the link. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a fresh access link for a person and invalidates their older unused links.
 * Needs the admin client (the invites table is closed to normal clients).
 */
export async function issueAccessLink(
  admin: SupabaseClient<Database>,
  params: { organizationId: string; userId: string; createdBy: string; origin: string },
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await admin.from("invites").delete().eq("user_id", params.userId).is("used_at", null);
  const { error } = await admin.from("invites").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    created_by: params.createdBy,
    token_hash: hashToken(token),
  });
  if (error) throw error;
  return `${params.origin}/zugang/${token}`;
}

export type ValidInvite = { id: string; userId: string; displayName: string; email: string; organizationName: string };

/** Looks up an unused, unexpired invite by its token. */
export async function findValidInvite(admin: SupabaseClient<Database>, token: string): Promise<ValidInvite | null> {
  const { data: invite } = await admin
    .from("invites")
    .select("id, user_id, expires_at, used_at, organizations(name), profiles!invites_user_id_fkey(display_name)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!invite || invite.used_at || new Date(invite.expires_at) <= new Date()) return null;

  const { data: user } = await admin.auth.admin.getUserById(invite.user_id);
  if (!user.user?.email) return null;

  return {
    id: invite.id,
    userId: invite.user_id,
    displayName: invite.profiles?.display_name ?? "",
    email: user.user.email,
    organizationName: invite.organizations?.name ?? "",
  };
}
