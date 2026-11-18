"use client";

import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/db/client";
import { subscribeToChanges } from "@/lib/db/realtime";

type Props = {
  roundId: string;
  job: {
    id: string;
    status: "pending" | "running" | "done" | "failed";
    error: string | null;
    attempts: number;
  } | null;
};

const POLL_MS = 4_000;
/** After the first minutes, look less often but never give up while the page is open. */
const SLOW_AFTER_MS = 180_000;
const SLOW_POLL_MS = 15_000;
/** Ask the server again now and then: it restarts a pending job or one whose worker died (stale after 5 min). */
const KICK_MS = 60_000;

/**
 * Shown while a closed round has no perspective map yet.
 * Starts the waiting analysis, then refreshes the page via Realtime (fallback: polling).
 * While it waits it asks the server again every minute, so a crashed run does not leave a spinner forever.
 */
export function AnalysisStatus({ roundId, job }: Props) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const waiting = job?.status === "pending" || job?.status === "running";

  useEffect(() => {
    if (!waiting) return;
    const kick = () => void apiFetch(`/api/rounds/${roundId}/analysis`, { method: "POST" });
    kick();
    const interval = setInterval(kick, KICK_MS);
    return () => clearInterval(interval);
  }, [roundId, waiting]);

  useEffect(() => {
    if (!waiting) return;
    const supabase = createClient();
    const refresh = () => router.refresh();
    const offAnalysis = subscribeToChanges(
      supabase,
      `analyses:${roundId}`,
      { table: "analyses", filter: `round_id=eq.${roundId}` },
      refresh,
    );
    const offJobs = subscribeToChanges(
      supabase,
      `analysis_jobs:${roundId}`,
      {
        table: "analysis_jobs",
        filter: `round_id=eq.${roundId}`,
        event: "UPDATE",
      },
      refresh,
    );
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      refresh();
      timer = setTimeout(poll, Date.now() - started > SLOW_AFTER_MS ? SLOW_POLL_MS : POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      offAnalysis();
      offJobs();
      clearTimeout(timer);
    };
  }, [roundId, waiting, router]);

  async function retry() {
    if (!job) return;
    setRetrying(true);
    setRetryError(null);
    const result = await apiFetch(`/api/jobs/${job.id}/retry`, {
      method: "POST",
    });
    setRetrying(false);
    if (!result.ok) setRetryError(result.error.message);
    else router.refresh();
  }

  if (!job) {
    return <p className="text-body text-ink-muted">Für diesen Austausch gibt es keine Perspektivenkarte.</p>;
  }

  if (job.status === "failed") {
    return (
      <div className="rounded-lg border border-line bg-card p-4 shadow-card" role="alert">
        <p className="flex items-start gap-2 text-body text-danger-ink">
          <TriangleAlert aria-hidden size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {job.error ?? "Die Perspektivenkarte konnte nicht erstellt werden."}
        </p>
        {job.attempts < 3 ? (
          <Button type="button" variant="secondary" className="mt-4" onClick={retry} disabled={retrying}>
            <RotateCcw aria-hidden size={20} strokeWidth={1.75} />
            {retrying ? "Startet …" : "Karte neu erstellen"}
          </Button>
        ) : null}
        {retryError ? <p className="mt-2 text-body-sm text-danger-ink">{retryError}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-card p-4 shadow-card" role="status">
      <LoaderCircle aria-hidden size={20} strokeWidth={1.75} className="animate-spin text-primary motion-reduce:animate-none" />
      <p className="text-body">AsyncMeet erstellt die Perspektivenkarte. Das dauert meist unter einer Minute.</p>
    </div>
  );
}
