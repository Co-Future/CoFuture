import type { SupabaseClient } from "@supabase/supabase-js";

type Change = { table: string; filter: string; event?: "*" | "INSERT" | "UPDATE" | "DELETE" };

/**
 * Subscribes to row changes as the signed-in user. The token is handed to Realtime BEFORE the
 * join; otherwise the join runs as an anonymous visitor and RLS (rightly) lets it see nothing.
 * Returns an unsubscribe function that is safe to call at any time.
 */
export function subscribeToChanges(
  supabase: SupabaseClient,
  name: string,
  change: Change,
  onChange: (payload: { new: Record<string, unknown> }) => void,
): () => void {
  let channel: ReturnType<SupabaseClient["channel"]> | null = null;
  let cancelled = false;

  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (cancelled || !data.session) return;
    await supabase.realtime.setAuth(data.session.access_token);
    if (cancelled) return;
    channel = supabase
      .channel(name)
      .on(
        "postgres_changes",
        { event: change.event ?? "*", schema: "public", table: change.table, filter: change.filter },
        (payload) => onChange({ new: (payload.new ?? {}) as Record<string, unknown> }),
      )
      .subscribe();
  })();

  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}
