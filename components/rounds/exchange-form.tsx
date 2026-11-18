"use client";

import { Plus, Trash2, UserRound, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { VoiceRecorder, type VoiceResult } from "@/components/rounds/voice-recorder";
import { Button, Field, FormError, TextAreaField } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { applyDictatedQuestions, questionCountFor, type DraftQuestion } from "@/lib/rounds/exchange-draft";
import { createExchangeSchema } from "@/lib/validation/round";

type Person = { userId: string; name: string };
type Props = {
  teamId: string;
  people: Person[];
  /** Follow-up: the closed origin exchange, and an optional prefilled question. */
  parentRoundId?: string;
  defaultQuestion?: string;
};

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const CHANGE_LABEL = { added: "Neu", modified: "Geändert" } as const;

/**
 * Prepare an exchange: dictate the questions (AsyncMeet pulls them out one by one), dictate again to
 * replace or to add, edit each question, choose who it is for, add questions as text, set a deadline.
 */
export function ExchangeForm({ teamId, people, parentRoundId, defaultQuestion }: Props) {
  const router = useRouter();
  const counter = useRef(0);
  const newKey = useCallback(() => `neu-${++counter.current}`, []);
  const [questions, setQuestions] = useState<DraftQuestion[]>(() =>
    defaultQuestion ? [{ key: "neu-0", body: defaultQuestion, targets: [] }] : [],
  );
  const [mode, setMode] = useState<"replace" | "merge">("merge");
  const [note, setNote] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [openTargets, setOpenTargets] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // The recorder reads the latest questions and mode when the recording is sent.
  const latest = useRef({ questions, mode });
  useEffect(() => {
    latest.current = { questions, mode };
  }, [questions, mode]);
  const recordingMode = questions.length === 0 ? "replace" : mode;

  const handleDictation = useCallback(
    (result: VoiceResult) => {
      const applied = applyDictatedQuestions(latest.current.questions, result, latest.current.questions.length === 0 ? "replace" : latest.current.mode, newKey);
      setQuestions(applied.questions);
      setNote(applied.note);
    },
    [newKey],
  );

  const update = (key: string, patch: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const toggleTarget = (key: string, userId: string) =>
    setQuestions((qs) =>
      qs.map((q) =>
        q.key === key
          ? { ...q, targets: q.targets.includes(userId) ? q.targets.filter((t) => t !== userId) : [...q.targets, userId] }
          : q,
      ),
    );
  const nameOf = (userId: string) => people.find((p) => p.userId === userId)?.name ?? "Unbekannt";

  function addQuestion() {
    const body = newQuestion.trim();
    if (body.length < 3) return;
    setQuestions((qs) => [...qs, { key: newKey(), body, targets: [], change: "added" }]);
    setNewQuestion("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const formElement = event.currentTarget;
    const local = String(new FormData(formElement).get("deadline") ?? "");
    const parsed = createExchangeSchema.safeParse({
      questions: questions.map((q) => ({ body: q.body, targets: q.targets })),
      // datetime-local has no time zone: interpret it in the browser's local time.
      deadline: local ? new Date(local).toISOString() : undefined,
      parentRoundId,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Prüf deine Eingaben.");
      return;
    }
    setPending(true);
    const result = await apiFetch<{ id: string }>(`/api/teams/${teamId}/rounds`, { method: "POST", body: parsed.data });
    if (!result.ok) {
      setFormError(result.error.message);
      setPending(false);
      return;
    }
    // Next keeps this page alive (Activity) after navigating away: start fresh for the next visit.
    formElement.reset();
    setQuestions([]);
    setNote(null);
    setPending(false);
    router.push(`/app/runden/${result.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex min-w-0 flex-col gap-6">
        {formError ? <FormError>{formError}</FormError> : null}

        <section aria-labelledby="dictate-heading" className="flex flex-col gap-3">
          <h2 id="dictate-heading" className="text-h3">
            Fragen einsprechen
          </h2>
          <p className="text-body-sm text-ink-muted">
            Sprich alle Fragen in einem Rutsch ein. AsyncMeet zieht die einzelnen Fragen heraus. Sagst du, an wen eine Frage geht
            („die Frage geht nur an Tom“), wird sie nur dieser Person gestellt.
          </p>
          {questions.length > 0 ? (
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">Was soll die nächste Aufnahme tun?</legend>
              {(
                [
                  ["merge", "Fragen ergänzen oder ändern"],
                  ["replace", "Alle Fragen neu einsprechen"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="inline-flex min-h-11 items-center gap-2 text-body">
                  <input type="radio" name="dictation-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                  {label}
                </label>
              ))}
            </fieldset>
          ) : null}
          <VoiceRecorder
            endpoint={`/api/teams/${teamId}/voice`}
            label=""
            startLabel={questions.length === 0 ? "Fragen einsprechen" : recordingMode === "merge" ? "Ergänzung einsprechen" : "Neu einsprechen"}
            onTranscript={handleDictation}
            extraBody={() => ({
              mode: latest.current.questions.length === 0 ? "replace" : latest.current.mode,
              questions: latest.current.questions.map((q) => ({ key: q.key, body: q.body, targets: q.targets })),
            })}
          />
          {note ? (
            <p role="status" className="text-body-sm text-ink">
              {note}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="questions-heading" className="flex flex-col gap-4">
          <h2 id="questions-heading" className="text-h3">
            Fragen ({questions.length})
          </h2>
          {questions.length === 0 ? (
            <p className="text-body text-ink-muted">Noch keine Fragen. Sprich sie oben ein oder schreib sie unten.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {questions.map((q, index) => (
                <li key={q.key} className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-body-sm text-ink-muted">Frage {index + 1}</span>
                    {q.change ? (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-body-sm text-ink">{CHANGE_LABEL[q.change]}</span>
                    ) : null}
                  </div>
                  <TextAreaField
                    id={`question-${q.key}`}
                    name={`question-${index}`}
                    label={`Text von Frage ${index + 1}`}
                    rows={2}
                    maxLength={500}
                    value={q.body}
                    onChange={(event) => update(q.key, { body: event.target.value, change: q.change })}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-body-sm text-ink-muted">
                      {q.targets.length === 0 ? <Users {...ICON} size={16} /> : <UserRound {...ICON} size={16} />}
                      Geht an:
                    </span>
                    {q.targets.length === 0 ? (
                      <span className="rounded-full bg-sunken px-2 py-0.5 text-body-sm">Alle im Team</span>
                    ) : (
                      q.targets.map((t) => (
                        <span key={t} className="rounded-full bg-sunken px-2 py-0.5 text-body-sm">
                          {nameOf(t)}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      aria-expanded={openTargets === q.key}
                      onClick={() => setOpenTargets(openTargets === q.key ? null : q.key)}
                    >
                      Personen wählen
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                      aria-label={`Frage ${index + 1} entfernen`}
                    >
                      <Trash2 {...ICON} />
                      Entfernen
                    </Button>
                  </div>
                  {openTargets === q.key ? (
                    <fieldset className="flex flex-col gap-1 rounded-md bg-sunken p-3">
                      <legend className="text-label">An wen geht Frage {index + 1}? Ohne Auswahl an alle.</legend>
                      {people.map((p) => (
                        <label key={p.userId} className="inline-flex min-h-11 items-center gap-2 text-body">
                          <input type="checkbox" checked={q.targets.includes(p.userId)} onChange={() => toggleTarget(q.key, p.userId)} />
                          {p.name}
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                </li>
              ))}
            </ol>
          )}

          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border-strong p-4">
            <TextAreaField
              id="new-question"
              name="new-question"
              label="Neue Frage hinzufügen"
              rows={2}
              maxLength={500}
              value={newQuestion}
              onChange={(event) => setNewQuestion(event.target.value)}
            />
            <div>
              <Button type="button" variant="secondary" onClick={addQuestion} disabled={newQuestion.trim().length < 3}>
                <Plus {...ICON} />
                Frage hinzufügen
              </Button>
            </div>
          </div>
        </section>

        <Field
          id="deadline"
          name="deadline"
          type="datetime-local"
          label="Frist (optional)"
          hint="Bis dahin kann jede gefragte Person antworten, danach schließt der Austausch automatisch. Ohne Frist schließt ihn, wer ihn gestartet hat."
        />
        <p className="text-body-sm text-ink-muted">Antworten erscheinen für alle nur mit Pseudonym (A01, A02 …), erst nach dem Schließen.</p>
        <div>
          <Button type="submit" disabled={pending || questions.length === 0}>
            Austausch starten
          </Button>
        </div>
      </div>

      <aside aria-labelledby="people-heading" className="flex flex-col gap-3">
        <h2 id="people-heading" className="text-h3">
          Personen im Team ({people.length})
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-card">
          {people.map((p) => {
            const count = questionCountFor(questions, p.userId);
            return (
              <li key={p.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-body">{p.name}</span>
                <span className="text-body-sm text-ink-muted">{count === 1 ? "1 Frage" : `${count} Fragen`}</span>
              </li>
            );
          })}
        </ul>
      </aside>
    </form>
  );
}
