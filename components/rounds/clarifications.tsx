"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, FormError, TextAreaField } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { clarificationAnswerSchema, clarificationSchema } from "@/lib/validation/round";

export type Clarification = {
  id: string;
  questionNumber: number | null;
  body: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  isOwn: boolean;
  authorName: string;
};

type Props = {
  roundId: string;
  items: Clarification[];
  questions: { id: string; number: number }[];
  /** The exchange is open: new follow-up questions are possible. */
  canAsk: boolean;
  /** You started the exchange: you answer follow-up questions. */
  canAnswer: boolean;
};

/** Follow-up questions to the person who started the exchange. Only the author and the starter see them. */
export function Clarifications({ roundId, items, questions, canAsk, canAnswer }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = clarificationSchema.safeParse({ body, questionId: questionId || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Prüf deine Rückfrage.");
      return;
    }
    setPending(true);
    const result = await apiFetch(`/api/rounds/${roundId}/clarifications`, { method: "POST", body: parsed.data });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setBody("");
    setQuestionId("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-body text-ink-muted">Noch keine Rückfragen.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4 shadow-card">
              <p className="flex flex-wrap items-center gap-2 text-body-sm text-ink-muted">
                <MessageCircleQuestion size={16} strokeWidth={1.75} aria-hidden />
                {item.questionNumber ? `Zu Frage ${item.questionNumber}` : "Zum ganzen Austausch"}
                {item.isOwn ? " · deine Rückfrage" : ` · von ${item.authorName}`} · {formatDateTime(item.createdAt)}
              </p>
              <p className="whitespace-pre-line text-body">{item.body}</p>
              {item.answer ? (
                <div className="rounded-md bg-sunken p-3">
                  <p className="text-label">Antwort</p>
                  <p className="mt-1 whitespace-pre-line text-body">{item.answer}</p>
                </div>
              ) : canAnswer ? (
                <AnswerForm id={item.id} onDone={() => router.refresh()} />
              ) : (
                <p className="text-body-sm text-ink-muted">Noch nicht beantwortet.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAsk ? (
        <form onSubmit={ask} noValidate className="flex flex-col gap-3">
          {error ? <FormError>{error}</FormError> : null}
          <div className="flex flex-col gap-1">
            <label htmlFor="clarification-question" className="text-label">
              Bezieht sich auf
            </label>
            <select
              id="clarification-question"
              value={questionId}
              onChange={(event) => setQuestionId(event.target.value)}
              className="min-h-11 rounded-md border border-border-strong bg-card px-3 text-body"
            >
              <option value="">den ganzen Austausch</option>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  Frage {q.number}
                </option>
              ))}
            </select>
          </div>
          <TextAreaField
            id="clarification-body"
            name="clarification"
            label="Rückfrage"
            rows={3}
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            hint="Nur du und die Person, die den Austausch gestartet hat, sehen die Rückfrage und die Antwort."
          />
          <div>
            <Button type="submit" variant="secondary" disabled={pending}>
              Rückfrage stellen
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function AnswerForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = clarificationAnswerSchema.safeParse({ answer });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Prüf deine Antwort.");
      return;
    }
    setPending(true);
    const result = await apiFetch(`/api/clarifications/${id}/answer`, { method: "POST", body: parsed.data });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setAnswer("");
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      {error ? <FormError>{error}</FormError> : null}
      <TextAreaField
        id={`clarification-answer-${id}`}
        name="answer"
        label="Deine Antwort"
        rows={2}
        maxLength={4000}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          Rückfrage beantworten
        </Button>
      </div>
    </form>
  );
}
