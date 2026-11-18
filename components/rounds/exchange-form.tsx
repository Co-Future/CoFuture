"use client";

import { ArrowLeft, Check, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Audience, Avatar, Card, QuestionNumber } from "@/components/rounds/exchange-ui";
import { VoiceRecorder, type VoiceResult } from "@/components/rounds/voice-recorder";
import { Button, Field, FormError, TextAreaField } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { applyDictatedQuestions, questionCountFor, type DraftQuestion } from "@/lib/rounds/exchange-draft";
import { createExchangeSchema } from "@/lib/validation/round";

type Person = { userId: string; name: string };
type Props = {
  teamId: string;
  /** Everyone in the team except you. */
  people: Person[];
  currentUserId: string;
  /** Follow-up: the closed origin exchange, and an optional prefilled question. */
  parentRoundId?: string;
  defaultQuestion?: string;
};

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const CHANGE_LABEL = { added: "Neu", modified: "Geändert" } as const;

/**
 * Prepare an exchange in two steps.
 * 1. Collect questions: dictate them in one go (AsyncMeet pulls them out and recognises who they are for),
 *    dictate again to replace or to add, edit, choose people, add questions as text.
 * 2. Check: every question once more, choose which ones you answer yourself, optional deadline, start.
 */
export function ExchangeForm({ teamId, people, currentUserId, parentRoundId, defaultQuestion }: Props) {
  const router = useRouter();
  const counter = useRef(0);
  const newKey = useCallback(() => `neu-${++counter.current}`, []);
  const [step, setStep] = useState<"collect" | "review">("collect");
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

  const handleDictation = useCallback(
    (result: VoiceResult) => {
      const current = latest.current;
      const applied = applyDictatedQuestions(current.questions, result, current.questions.length === 0 ? "replace" : current.mode, newKey);
      setQuestions(applied.questions);
      setNote(applied.note);
    },
    [newKey],
  );

  const update = (key: string, patch: Partial<DraftQuestion>) => setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const toggleTarget = (key: string, userId: string) =>
    setQuestions((qs) =>
      qs.map((q) =>
        q.key === key ? { ...q, targets: q.targets.includes(userId) ? q.targets.filter((t) => t !== userId) : [...q.targets, userId] } : q,
      ),
    );
  const namesOf = (ids: string[]) => ids.map((id) => people.find((p) => p.userId === id)?.name ?? "Unbekannt");
  const valid = questions.length > 0 && questions.every((q) => q.body.trim().length >= 3);

  function addQuestion() {
    const body = newQuestion.trim();
    if (body.length < 3) return;
    setQuestions((qs) => [...qs, { key: newKey(), body, targets: [], change: "added" }]);
    setNewQuestion("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "collect") {
      setStep("review");
      return;
    }
    setFormError(null);
    const formElement = event.currentTarget;
    const local = String(new FormData(formElement).get("deadline") ?? "");
    const parsed = createExchangeSchema.safeParse({
      questions: questions.map((q) => ({ body: q.body, targets: q.targets, asksStarter: Boolean(q.asksStarter) })),
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
    setStep("collect");
    setPending(false);
    router.push(`/app/runden/${result.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <ol className="flex flex-wrap items-center gap-3 text-body-sm" aria-label="Schritte">
        {(
          [
            ["collect", "Fragen sammeln"],
            ["review", "Prüfen und starten"],
          ] as const
        ).map(([value, label], i) => (
          <li key={value} className="flex items-center gap-3">
            {i > 0 ? <span className="h-px w-8 bg-border-strong" aria-hidden /> : null}
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
                step === value ? "bg-primary text-on-primary" : "bg-sunken text-ink-muted"
              }`}
              aria-current={step === value ? "step" : undefined}
            >
              <span className="font-semibold">{i + 1}</span>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {formError ? <FormError>{formError}</FormError> : null}

      {step === "collect" ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card className="flex flex-col gap-4">
              <div>
                <h2 className="text-h3">{questions.length === 0 ? "Fragen einsprechen" : "Weitere Aufnahme"}</h2>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Sprich alle Fragen in einem Rutsch ein. AsyncMeet zieht die einzelnen Fragen heraus. Sagst du, an wen eine Frage geht
                  („die Frage geht an Tom und Lars“), wird sie nur diesen Personen gestellt und nur ihnen angezeigt.
                </p>
              </div>
              {questions.length > 0 ? (
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">Was soll die nächste Aufnahme tun?</legend>
                  {(
                    [
                      ["merge", "Ergänzen oder ändern"],
                      ["replace", "Alle neu einsprechen"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-body has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                        mode === value ? "border-primary bg-primary-soft text-ink" : "border-line bg-card text-ink-muted"
                      }`}
                    >
                      <input type="radio" name="dictation-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
                      {mode === value ? <Check {...ICON} size={16} /> : null}
                      {label}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <VoiceRecorder
                endpoint={`/api/teams/${teamId}/voice`}
                label=""
                compact
                startLabel={questions.length === 0 ? "Fragen einsprechen" : mode === "merge" ? "Ergänzung einsprechen" : "Neu einsprechen"}
                onTranscript={handleDictation}
                extraBody={() => ({
                  mode: latest.current.questions.length === 0 ? "replace" : latest.current.mode,
                  questions: latest.current.questions.map((q) => ({ key: q.key, body: q.body, targets: q.targets })),
                })}
              />
              {note ? (
                <p role="status" className="rounded-md bg-primary-soft px-3 py-2 text-body-sm text-ink">
                  {note}
                </p>
              ) : null}
            </Card>

            <section aria-labelledby="questions-heading" className="flex flex-col gap-3">
              <h2 id="questions-heading" className="text-h3">
                Fragen <span className="text-ink-muted">({questions.length})</span>
              </h2>
              {questions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-body text-ink-muted">
                  Noch keine Fragen. Sprich sie oben ein oder schreib sie unten.
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {questions.map((q, index) => (
                    <li key={q.key}>
                      <Card className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <QuestionNumber n={index + 1} />
                          <div className="flex min-w-0 flex-1 flex-col gap-3">
                            {q.change ? (
                              <span className="w-fit rounded-full bg-primary-soft px-2 py-0.5 text-caption font-semibold text-primary">
                                {CHANGE_LABEL[q.change]}
                              </span>
                            ) : null}
                            <label htmlFor={`question-${q.key}`} className="sr-only">
                              Text von Frage {index + 1}
                            </label>
                            <textarea
                              id={`question-${q.key}`}
                              rows={2}
                              maxLength={500}
                              value={q.body}
                              onChange={(event) => update(q.key, { body: event.target.value })}
                              className="w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-h3 text-ink hover:border-line focus:border-primary"
                            />
                            <Audience names={namesOf(q.targets)} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-11">
                          <Button
                            type="button"
                            variant="secondary"
                            aria-expanded={openTargets === q.key}
                            onClick={() => setOpenTargets(openTargets === q.key ? null : q.key)}
                          >
                            <UserPlus {...ICON} />
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
                          <fieldset className="ml-11 flex flex-wrap gap-2 rounded-md bg-sunken p-3">
                            <legend className="mb-2 text-label">An wen geht Frage {index + 1}? Ohne Auswahl an alle.</legend>
                            {people.map((p) => {
                              const on = q.targets.includes(p.userId);
                              return (
                                <label
                                  key={p.userId}
                                  className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-body has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                                    on ? "border-primary bg-primary-soft" : "border-line bg-card"
                                  }`}
                                >
                                  <input type="checkbox" checked={on} onChange={() => toggleTarget(q.key, p.userId)} className="sr-only" />
                                  {on ? <Check {...ICON} size={16} /> : <Avatar name={p.name} size="sm" />}
                                  {p.name}
                                </label>
                              );
                            })}
                          </fieldset>
                        ) : null}
                      </Card>
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

            <div>
              <Button type="submit" disabled={!valid}>
                Fragen prüfen
              </Button>
            </div>
          </div>

          <PeoplePanel people={people} questions={questions} currentUserId={currentUserId} />
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-w-0 flex-col gap-6">
            <div>
              <h2 className="text-h2">Fragen prüfen</h2>
              <p className="mt-1 text-body text-ink-muted">
                So bekommt dein Team die Fragen. Wähl aus, welche du selbst auch beantwortest.
              </p>
            </div>
            <ol className="flex flex-col gap-3">
              {questions.map((q, index) => (
                <li key={q.key}>
                  <Card className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <QuestionNumber n={index + 1} />
                      <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <p className="font-display text-h3 text-ink">{q.body}</p>
                        <Audience names={namesOf(q.targets)} />
                        <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-3 text-body">
                          <input
                            type="checkbox"
                            checked={Boolean(q.asksStarter)}
                            onChange={(event) => update(q.key, { asksStarter: event.target.checked })}
                            className="h-5 w-5 accent-[var(--primary)]"
                          />
                          Ich beantworte diese Frage selbst
                        </label>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>

            <Card className="flex flex-col gap-2">
              <Field
                id="deadline"
                name="deadline"
                type="datetime-local"
                label="Frist (optional)"
                hint="Bis dahin können alle Gefragten antworten, danach schließt der Austausch automatisch. Ohne Frist schließt du ihn selbst."
              />
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep("collect")}>
                <ArrowLeft {...ICON} />
                Zurück zum Bearbeiten
              </Button>
              <Button type="submit" disabled={pending || !valid}>
                {pending ? "Wird gestartet …" : "Austausch starten"}
              </Button>
            </div>
          </div>

          <PeoplePanel people={people} questions={questions} currentUserId={currentUserId} onEdit={() => setStep("collect")} />
        </div>
      )}
    </form>
  );
}

function PeoplePanel({
  people,
  questions,
  currentUserId,
  onEdit,
}: {
  people: Person[];
  questions: DraftQuestion[];
  currentUserId: string;
  onEdit?: () => void;
}) {
  const mine = questionCountFor(questions, currentUserId, currentUserId);
  return (
    <aside aria-labelledby="people-heading" className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
      <h2 id="people-heading" className="text-h3">
        Wer bekommt was
      </h2>
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-card">
        {people.map((p) => {
          const count = questionCountFor(questions, p.userId, currentUserId);
          return (
            <li key={p.userId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={p.name} />
              <span className="min-w-0 flex-1 truncate text-body">{p.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-body-sm ${count > 0 ? "bg-primary-soft text-ink" : "bg-sunken text-ink-muted"}`}>
                {count}
              </span>
            </li>
          );
        })}
        <li className="flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1 text-body text-ink-muted">Du selbst</span>
          <span className={`rounded-full px-2 py-0.5 text-body-sm ${mine > 0 ? "bg-primary-soft text-ink" : "bg-sunken text-ink-muted"}`}>{mine}</span>
        </li>
      </ul>
      {onEdit ? (
        <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center gap-2 text-body-sm text-primary underline">
          <Pencil size={16} strokeWidth={1.75} aria-hidden />
          Personen ändern
        </button>
      ) : null}
    </aside>
  );
}
