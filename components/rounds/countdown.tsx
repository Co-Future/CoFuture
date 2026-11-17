"use client";

import { useSyncExternalStore } from "react";
import { formatRemaining } from "@/lib/format";

const TICK_MS = 30_000;

function subscribe(onTick: () => void) {
  const interval = setInterval(onTick, TICK_MS);
  return () => clearInterval(interval);
}
// Snapshot changes once per tick, so React re-renders at most every 30 s.
const getSnapshot = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;
const getServerSnapshot = () => null;

/** Time left until the deadline. Rendered only in the browser; not a live region on purpose. */
export function Countdown({ deadline }: { deadline: string }) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (now === null) return null;
  const text = formatRemaining(Date.parse(deadline) - now);
  return text ? <span className="text-body-sm font-semibold text-ink">{text}</span> : null;
}
