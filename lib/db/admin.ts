import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Supabase client with the secret key: bypasses RLS. Server only, and only for work that
 * has no signed-in user (the job worker). Never import this from a Client Component.
 */
export function createAdminClient() {
  const secret = serverEnv().SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. See .env.example.");
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
