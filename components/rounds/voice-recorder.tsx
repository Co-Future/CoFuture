"use client";

import { Mic, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/db/client";
import { subscribeToChanges } from "@/lib/db/realtime";
import { baseMime, MAX_RECORDING_MS } from "@/lib/validation/voice";

type Phase =
  | { name: "idle" }
  | { name: "recording"; startedAt: number }
  | { name: "recorded"; blob: Blob; mime: string; durationMs: number; url: string }
  | { name: "working"; step: "upload" | "transcribe"; jobId?: string }
  | { name: "failed"; message: string; jobId?: string; canRetry: boolean };

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];
const POLL_MS = 3_000;

function pickMime(): string | undefined {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

// Recording support is only known in the browser. The server snapshot (null) renders nothing,
// so server HTML and the first client render match.
const noSubscribe = () => () => {};
const browserSupport = () => "MediaRecorder" in window && Boolean(navigator.mediaDevices);
const serverSupport = () => null;

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function micError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return "Kein Zugriff auf das Mikrofon. Erlaube es in den Browser-Einstellungen oder antworte als Text.";
  if (name === "NotFoundError") return "Kein Mikrofon gefunden. Schließ eins an oder antworte als Text.";
  return "Die Aufnahme konnte nicht starten. Antworte bitte als Text.";
}

/** Finished job result: the transcript, plus the structure AsyncMeet made of it (questions or answers). */
export type VoiceResult = { text: string; structured?: unknown };

type Props = {
  /** Endpoint that queues the transcription, e.g. /api/rounds/{id}/voice or /api/teams/{id}/voice. */
  endpoint: string;
  label: string;
  onTranscript: (result: VoiceResult) => void;
  /** Extra fields for the job request, read when the recording is sent (e.g. the current questions). */
  extraBody?: () => Record<string, unknown>;
  /** Text of the start button. */
  startLabel?: string;
  /** Smaller variant without border, e.g. inside a question card. */
  compact?: boolean;
};

/**
 * Records a voice answer (max. 10 min), uploads it straight to the private bucket and waits for the
 * transcript. The transcript goes to the parent, which appends and saves it right away.
 */
export function VoiceRecorder({ endpoint, label, onTranscript, extraBody, startLabel = "Aufnahme starten", compact = false }: Props) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<() => void>(() => {});
  const supported = useSyncExternalStore(noSubscribe, browserSupport, serverSupport);

  // Release the microphone and timers when the component goes away.
  useEffect(() => () => stopTimer.current(), []);

  // Free the preview URL when it is no longer shown.
  const previewUrl = phase.name === "recorded" ? phase.url : null;
  useEffect(() => () => (previewUrl ? URL.revokeObjectURL(previewUrl) : undefined), [previewUrl]);

  // Wait for the transcript: Realtime push, with polling as a fallback.
  const jobId = phase.name === "working" ? phase.jobId : undefined;
  useEffect(() => {
    if (!jobId) return;
    const supabase = createClient();
    let finished = false;
    const check = async () => {
      if (finished) return;
      const { data } = await supabase.from("analysis_jobs").select("status, result, error, attempts").eq("id", jobId).maybeSingle();
      if (!data || finished) return;
      if (data.status === "done") {
        finished = true;
        const result = (data.result ?? {}) as { text?: string; structured?: unknown };
        onTranscript({ text: String(result.text ?? ""), structured: result.structured });
        setPhase({ name: "idle" });
      } else if (data.status === "failed") {
        finished = true;
        setPhase({ name: "failed", message: data.error ?? "Die Transkription ist fehlgeschlagen.", jobId, canRetry: data.attempts < 3 });
      }
    };
    const unsubscribe = subscribeToChanges(supabase, `job:${jobId}`, { table: "analysis_jobs", filter: `id=eq.${jobId}` }, () => void check());
    const interval = setInterval(() => void check(), POLL_MS);
    void check();
    return () => {
      finished = true;
      unsubscribe();
      clearInterval(interval);
    };
  }, [jobId, onTranscript]);

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (error) {
      setPhase({ name: "failed", message: micError(error), canRetry: false });
      return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32_000 });
    const chunks: Blob[] = [];
    const startedAt = Date.now();

    // Level meter
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const meter = () => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const v of samples) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(1, peak / 64));
      frame = requestAnimationFrame(meter);
    };
    frame = requestAnimationFrame(meter);

    const tick = setInterval(() => {
      const ms = Date.now() - startedAt;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) rec.stop();
    }, 250);

    let released = false;
    stopTimer.current = () => {
      if (released) return;
      released = true;
      clearInterval(tick);
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((t) => t.stop());
      void audioContext.close();
    };

    rec.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    rec.onstop = () => {
      stopTimer.current();
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunks, { type });
      setLevel(0);
      setPhase({ name: "recorded", blob, mime: type, durationMs: Math.min(Date.now() - startedAt, MAX_RECORDING_MS), url: URL.createObjectURL(blob) });
    };

    recorder.current = rec;
    rec.start();
    setElapsed(0);
    setPhase({ name: "recording", startedAt });
  }

  function stop() {
    recorder.current?.stop();
  }

  async function submit() {
    if (phase.name !== "recorded") return;
    const { blob, mime, durationMs } = phase;
    setPhase({ name: "working", step: "upload" });

    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
      setPhase({ name: "failed", message: "Deine Sitzung ist abgelaufen. Melde dich neu an.", canRetry: false });
      return;
    }
    const type = baseMime(mime);
    const path = `${userId}/${crypto.randomUUID()}.${type.split("/")[1]}`;
    const upload = await supabase.storage.from("voice").upload(path, blob, { contentType: type });
    if (upload.error) {
      setPhase({ name: "failed", message: "Die Aufnahme konnte nicht hochgeladen werden. Prüf dein Netz und versuch es noch einmal.", canRetry: false });
      return;
    }
    const result = await apiFetch<{ jobId: string }>(endpoint, {
      method: "POST",
      body: { ...(extraBody?.() ?? {}), path, mime: type, durationMs },
    });
    if (!result.ok) {
      setPhase({ name: "failed", message: result.error.message, canRetry: false });
      return;
    }
    setPhase({ name: "working", step: "transcribe", jobId: result.data.jobId });
  }

  async function retry() {
    if (phase.name !== "failed" || !phase.jobId) return;
    const id = phase.jobId;
    const result = await apiFetch(`/api/jobs/${id}/retry`, { method: "POST" });
    if (!result.ok) {
      setPhase({ name: "failed", message: result.error.message, canRetry: false });
      return;
    }
    setPhase({ name: "working", step: "transcribe", jobId: id });
  }

  if (supported === null) return null;
  if (!supported) {
    return <p className="text-body-sm text-ink-muted">Dein Browser unterstützt keine Sprachaufnahme. Antworte bitte als Text.</p>;
  }

  return (
    <div className={compact ? "flex flex-col gap-3" : "flex flex-col gap-3 rounded-lg border border-line bg-card p-4"}>
      {label ? (
        <p className="text-label text-ink">
          {label} (max. {MAX_RECORDING_MS / 60_000} Min.)
        </p>
      ) : null}

      {phase.name === "idle" ? (
        <div>
          <Button type="button" variant="secondary" onClick={start}>
            <Mic {...ICON} />
            {startLabel}
          </Button>
        </div>
      ) : null}

      {phase.name === "recording" ? (
        <div className="flex flex-wrap items-center gap-4">
          <Button type="button" onClick={stop}>
            <Square {...ICON} />
            Aufnahme beenden
          </Button>
          <span className="inline-flex items-center gap-2 text-body-sm text-ink" aria-live="off">
            <span className="h-2 w-2 rounded-full bg-danger" aria-hidden />
            Aufnahme läuft <span className="font-mono">{clock(elapsed)} / {clock(MAX_RECORDING_MS)}</span>
          </span>
          <span className="h-2 w-24 overflow-hidden rounded-full bg-sunken" aria-hidden>
            <span className="block h-full bg-primary" style={{ width: `${Math.round(level * 100)}%` }} />
          </span>
        </div>
      ) : null}

      {phase.name === "recorded" ? (
        <div className="flex flex-col gap-3">
          <audio controls src={phase.url} className="w-full max-w-[480px]">
            Dein Browser kann die Aufnahme nicht abspielen.
          </audio>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={submit}>
              Aufnahme auswerten
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPhase({ name: "idle" })}>
              <RotateCcw {...ICON} />
              Neu aufnehmen
            </Button>
          </div>
          <p className="text-body-sm text-ink-muted">Die Aufnahme wird nach dem Transkribieren gelöscht.</p>
        </div>
      ) : null}

      <p role="status" className="text-body-sm text-ink">
        {phase.name === "working" ? (phase.step === "upload" ? "Aufnahme wird hochgeladen …" : "AsyncMeet transkribiert und ordnet die Aufnahme …") : null}
      </p>

      {phase.name === "failed" ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body-sm text-danger-ink">
            <span className="font-semibold">Fehler: </span>
            {phase.message}
          </p>
          <div className="flex flex-wrap gap-2">
            {phase.canRetry ? (
              <Button type="button" onClick={retry}>
                Erneut versuchen
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => setPhase({ name: "idle" })}>
              Neu aufnehmen
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
