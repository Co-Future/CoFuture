"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/db/client";
import { subscribeToChanges } from "@/lib/db/realtime";

type Props = {
  /** Which rounds to watch: all of a team, or a single round. */
  filter: { column: "team_id" | "id"; value: string };
  /** Deadlines of the rounds on this page that are still open. */
  openDeadlines: string[];
};

const MAX_TIMEOUT = 2_147_483_647;
const POLL_MS = 15_000;

/**
 * Keeps a page in sync with its rounds without a reload:
 * 1. Supabase Realtime pushes every change (closed early, closed by the deadline job, new round).
 * 2. Fallback: shortly after the next deadline the page checks itself until the round has closed.
 * 3. When the tab becomes visible again (e.g. after standby) the page refreshes once.
 * Renders nothing.
 */
export function RoundsLiveRefresh({ filter, openDeadlines }: Props) {
  const router = useRouter();
  const lastRefresh = useRef(0);
  const deadlinesKey = openDeadlines.join("|");

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh.current < 1_000) return;
      lastRefresh.current = now;
      router.refresh();
    };

    const unsubscribe = subscribeToChanges(
      createClient(),
      `rounds:${filter.column}:${filter.value}`,
      { table: "rounds", filter: `${filter.column}=eq.${filter.value}` },
      refresh,
    );

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, [filter.column, filter.value, router]);

  useEffect(() => {
    const deadlines = deadlinesKey ? deadlinesKey.split("|").map((d) => Date.parse(d)) : [];
    if (deadlines.length === 0) return;
    const next = Math.min(...deadlines);
    const delay = next - Date.now() + 3_000;

    // Deadline already passed but the round is still open: the closing job runs every minute, so poll.
    if (delay <= 0) {
      const interval = setInterval(() => router.refresh(), POLL_MS);
      return () => clearInterval(interval);
    }
    const timeout = setTimeout(() => router.refresh(), Math.min(delay, MAX_TIMEOUT));
    return () => clearTimeout(timeout);
  }, [deadlinesKey, router]);

  return null;
}
