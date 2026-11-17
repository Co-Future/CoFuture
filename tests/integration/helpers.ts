import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { publicEnv } from "@/lib/env";

/** Creates throwaway test users with made-up data. Needs email confirmation switched off. */
export const env = publicEnv();
const run = crypto.randomUUID().slice(0, 8);

export type TestUser = { client: SupabaseClient<Database>; userId: string; email: string };

export async function signUp(name: string): Promise<TestUser> {
  const client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `cofuture.test+${run}-${name}@gmail.com`;
  const { data, error } = await client.auth.signUp({
    email,
    password: `Test-${crypto.randomUUID()}`,
    options: { data: { display_name: `Test ${name}` } },
  });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error("No session: is email confirmation switched off?");
  return { client, userId: data.user.id, email };
}

export const testRun = run;

/**
 * Deletes all accounts of this run (and teams only they were in). Needs SUPABASE_SECRET_KEY;
 * without it the hourly database job purge-test-users cleans up.
 */
export async function cleanUpTestRun(): Promise<void> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return;
  const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.rpc("purge_test_users", { p_run: run });
  if (error) console.warn(`Testnutzer konnten nicht gelöscht werden: ${error.message}`);
}
