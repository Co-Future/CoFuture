"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VoiceRecorder, type VoiceResult } from "@/components/rounds/voice-recorder";
import { Button, FormError, TextAreaField } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { appendToAnswer, applySpokenAnswers } from "@/lib/rounds/answers-draft";

type Question = { id: string; number: number; body: string };
type Props = {
  roundId: string;
  /** Only the questions addressed to you. */
  questions: Question[];
  saved: Record<string, string>;
  pseudonym: string | null;
};

/**
 * Answer every question addressed to you: speak once and AsyncMeet puts each part under its question,
 * or write and supplement each card. The cards are saved right after a recording (the audio is deleted
 * after transcription) and whenever you press save. Others see them only after the exchange closes.
 */
export function AnswerEditor({ roundId, questions, saved, pseudonym }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(saved);
  const [unassigned, setUnassigned] = useState("");
  const [mode, setMode] = useState<"replace" | "merge">("merge");
  const [note, setNote] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const latest = useRef({ answers, mode });
  useEffect(() => {
    latest.current = { answers, mode };
  }, [answers, mode]);

  const hasAnswers = Object.values(saved).some((a) => a.trim());

  const save = useCallback(
    async (next: Record<string, string>, source: "text" | "voice") => {
      setError(null);
      setStatus(null);
      setPending(true);
      const result = await apiFetch<{ pseudonym: string | null }>(`/api/rounds/${roundId}/answers`, {
        method: "PUT",
        body: { source, answers: questions.map((q) => ({ questionId: q.id, body: next[q.id] ?? "" })) },
      });
      setPending(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setStatus(
        result.data.pseudonym
          ? `Antworten gespeichert. Du erscheinst als ${result.data.pseudonym}. Bis zum Schließen kannst du alles ändern.`
          : "Deine Antworten sind entfernt.",
      );
      router.refresh();
    },
    [roundId, questions, router],
  );

  const handleAll = useCallback(
    (result: VoiceResult) => {
      const applied = applySpokenAnswers(
        latest.current.answers,
        result,
        latest.current.mode,
        questions.map((q) => q.id),
      );
      setAnswers(applied.answers);
      setUnassigned(applied.unassigned);
      setNote(applied.note);
      void save(applied.answers, "voice");
    },
    [questions, save],
  );

  // One stable handler per card, so a recorder does not re-subscribe on every keystroke.
  const handleOne = useMemo(
    () =>
      Object.fromEntries(
        questions.map((q) => [
          q.id,
          (result: VoiceResult) => {
            const next = appendToAnswer(latest.current.answers, q.id, result.text);
            setAnswers(next);
            void save(next, "voice");
          },
        ]),
      ),
    [questions, save],
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="speak-all-heading" className="flex flex-col gap-3">
        <h3 id="speak-all-heading" className="text-h3">
          Alles auf einmal einsprechen
        </h3>
        <p className="text-body-sm text-ink-muted">
          Sprich einfach drauflos. AsyncMeet ordnet deine Antwort den Fragen zu, du prüfst danach jede Karte.
        </p>
        {hasAnswers || Object.values(answers).some((a) => a.trim()) ? (
          <fieldset className="flex flex-wrap gap-4">
            <legend className="sr-only">Was soll die nächste Aufnahme tun?</legend>
            {(
              [
                ["merge", "Antworten ergänzen"],
                ["replace", "Alle Antworten neu einsprechen"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="inline-flex min-h-11 items-center gap-2 text-body">
                <input type="radio" name="answer-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                {label}
              </label>
            ))}
          </fieldset>
        ) : null}
        <VoiceRecorder
          endpoint={`/api/rounds/${roundId}/voice`}
          label=""
          startLabel="Antworten einsprechen"
          onTranscript={handleAll}
          extraBody={() => ({ scope: "all" })}
        />
        {note ? (
          <p role="status" className="text-body-sm text-ink">
            {note}
          </p>
        ) : null}
        {unassigned ? (
          <div className="rounded-md bg-warning-soft p-3 text-body-sm text-warning-ink">
            <p className="font-semibold">Nicht zugeordnet</p>
            <p className="mt-1 whitespace-pre-line">{unassigned}</p>
            <p className="mt-2">Gehört etwas davon zu einer Frage, kopier es in die Karte. Eine Frage an die Leitung stellst du unten als Rückfrage.</p>
          </div>
        ) : null}
      </section>

      {error ? <FormError>{error}</FormError> : null}

      <ol className="flex flex-col gap-4">
        {questions.map((q) => (
          <li key={q.id} className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-card">
            <p className="text-body font-semibold">
              <span className="mr-2 font-mono text-body-sm text-ink-muted">Frage {q.number}</span>
              {q.body}
            </p>
            <TextAreaField
              id={`answer-${q.id}`}
              name={`answer-${q.number}`}
              label={`Deine Antwort auf Frage ${q.number}`}
              rows={4}
              maxLength={10000}
              value={answers[q.id] ?? ""}
              onChange={(event) => setAnswers((a) => ({ ...a, [q.id]: event.target.value }))}
            />
            <VoiceRecorder
              endpoint={`/api/rounds/${roundId}/voice`}
              label=""
              compact
              startLabel="Per Sprache ergänzen"
              onTranscript={handleOne[q.id]}
              extraBody={() => ({ scope: "question" })}
            />
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending} onClick={() => void save(answers, "text")}>
          Antworten speichern
        </Button>
        <p role="status" className="text-body-sm text-success-ink">
          {status ?? (pseudonym ? `Gespeichert als ${pseudonym}.` : null)}
        </p>
      </div>
    </div>
  );
}
