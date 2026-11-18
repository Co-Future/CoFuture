"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VoiceRecorder, type VoiceResult } from "@/components/rounds/voice-recorder";
import { AnswerBox, Card, QuestionNumber } from "@/components/rounds/exchange-ui";
import { Button, FormError } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { appendToAnswer, applySpokenAnswers } from "@/lib/rounds/answers-draft";

type Question = { id: string; number: number; body: string };
type Props = {
  roundId: string;
  /** Only the questions addressed to you. */
  questions: Question[];
  saved: Record<string, string>;
};

/**
 * Answer every question addressed to you: speak once and AsyncMeet puts each part under its question,
 * or write and supplement each card. The cards are saved right after a recording (the audio is deleted
 * after transcription) and whenever you press save. Others see them only after the exchange closes.
 */
export function AnswerEditor({ roundId, questions, saved }: Props) {
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
          ? "Antworten gespeichert. Bis zum Schließen kannst du alles ändern, sichtbar werden sie erst danach."
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
            // AsyncMeet's summary of the supplement if there is one, else the plain transcript.
            const mapped = applySpokenAnswers({}, result, "replace", [q.id]).answers[q.id];
            const next = appendToAnswer(latest.current.answers, q.id, mapped ?? result.text);
            setAnswers(next);
            void save(next, "voice");
          },
        ]),
      ),
    [questions, save],
  );

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="text-h3">Alles auf einmal einsprechen</h3>
          <p className="mt-1 text-body-sm text-ink-muted">
            Sprich einfach drauflos. AsyncMeet fasst deine Antwort je Frage zusammen und legt sie unter die passende Frage. Du prüfst danach jede Antwort.
          </p>
        </div>
        {hasAnswers || Object.values(answers).some((a) => a.trim()) ? (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Was soll die nächste Aufnahme tun?</legend>
            {(
              [
                ["merge", "Antworten ergänzen"],
                ["replace", "Alle neu einsprechen"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-body has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                  mode === value ? "border-primary bg-primary-soft text-ink" : "border-line bg-card text-ink-muted"
                }`}
              >
                <input type="radio" name="answer-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </fieldset>
        ) : null}
        <VoiceRecorder
          endpoint={`/api/rounds/${roundId}/voice`}
          label=""
          compact
          startLabel="Antworten einsprechen"
          onTranscript={handleAll}
          extraBody={() => ({ scope: "all" })}
        />
        {note ? (
          <p role="status" className="rounded-md bg-primary-soft px-3 py-2 text-body-sm text-ink">
            {note}
          </p>
        ) : null}
        {unassigned ? (
          <div className="rounded-md bg-warning-soft p-3 text-body-sm text-warning-ink">
            <p className="font-semibold">Keiner Frage zugeordnet</p>
            <p className="mt-1 whitespace-pre-line">{unassigned}</p>
            <p className="mt-2">Gehört etwas davon zu einer Frage, übernimm es in die Antwort. Eine Frage an die Leitung stellst du unten als Rückfrage.</p>
          </div>
        ) : null}
      </Card>

      {error ? <FormError>{error}</FormError> : null}

      <ol className="flex flex-col gap-4">
        {questions.map((q) => (
          <li key={q.id}>
            <Card className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <QuestionNumber n={q.number} />
                <p className="font-display text-h3 text-ink">{q.body}</p>
              </div>
              <AnswerBox label="Deine Antwort">
                <label htmlFor={`answer-${q.id}`} className="sr-only">
                  Deine Antwort auf Frage {q.number}
                </label>
                <textarea
                  id={`answer-${q.id}`}
                  rows={answers[q.id] ? 4 : 2}
                  maxLength={10000}
                  value={answers[q.id] ?? ""}
                  placeholder="Noch keine Antwort. Sprich sie ein oder schreib sie hier."
                  onChange={(event) => setAnswers((a) => ({ ...a, [q.id]: event.target.value }))}
                  className="mt-1 w-full resize-y rounded-md border border-transparent bg-card/70 px-3 py-2 text-body text-ink placeholder:text-ink-muted hover:border-line focus:border-primary"
                />
              </AnswerBox>
              <VoiceRecorder
                endpoint={`/api/rounds/${roundId}/voice`}
                label=""
                compact
                startLabel="Diese Antwort per Sprache ergänzen"
                onTranscript={handleOne[q.id]}
                extraBody={() => ({ scope: "question", questionId: q.id })}
              />
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending} onClick={() => void save(answers, "text")}>
          {pending ? "Wird gespeichert …" : "Antworten speichern"}
        </Button>
        <p role="status" className="text-body-sm text-success-ink">
          {status ?? (saved && Object.keys(saved).length > 0 ? "Gespeichert. Sichtbar werden deine Antworten erst, wenn der Austausch schließt." : null)}
        </p>
      </div>
    </div>
  );
}
