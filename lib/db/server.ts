import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Acts as the signed-in user (RLS applies). Create a new client per request.
 */
export async function createClient() {
  // Everything behind this client is per user and per request: never prerender it.
  // This also keeps builds independent of the env vars and lets Supabase read the clock.
  await connection();
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the session instead.
        }
      },
    },
  });
}
