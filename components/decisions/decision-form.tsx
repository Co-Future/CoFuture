"use client";

import { Check, Gavel, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { VoiceRecorder, type VoiceResult } from "@/components/rounds/voice-recorder";
import { Button, FormError, TextAreaField } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { fieldErrors } from "@/lib/validation/auth";
import { decisionSchema } from "@/lib/validation/decision";

type Props = {
  roundId: string;
  /** Clusters of the perspective map, by their position in the map. */
  clusters: { index: number; title: string; kindLabel: string }[];
};

type Proposal = { body: string; rationale: string; clusterRefs: number[] };
type ProposalState =
  | { name: "idle" }
  | { name: "loading" }
  | { name: "shown"; proposals: Proposal[]; model: string | null }
  | { name: "error"; message: string };

/**
 * A person writes the decision with a rationale. AsyncMeet can propose a decision from the summary
 * or split a dictated one into decision and rationale; the person checks, changes and decides.
 */
export function DecisionForm({ roundId, clusters }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [rationale, setRationale] = useState("");
  const [refs, setRefs] = useState<number[]>([]);
  const [errors, setErrors] = useState<Partial<Record<"body" | "rationale", string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [proposal, setProposal] = useState<ProposalState>({ name: "idle" });
  const [note, setNote] = useState<string | null>(null);

  const titleOf = (i: number) => clusters.find((c) => c.index === i)?.title;

  async function requestProposal() {
    setProposal({ name: "loading" });
    setNote(null);
    const result = await apiFetch<{ proposals: Proposal[]; model: string | null }>(`/api/rounds/${roundId}/decision/proposal`, {
      method: "POST",
    });
    if (!result.ok) setProposal({ name: "error", message: result.error.message });
    else setProposal({ name: "shown", proposals: result.data.proposals, model: result.data.model });
  }

  function takeOver(p: Proposal) {
    setBody(p.body);
    setRationale(p.rationale);
    setRefs(p.clusterRefs.filter((i) => clusters.some((c) => c.index === i)));
    setProposal({ name: "idle" });
    setNote("Vorschlag übernommen. Prüf und ändere ihn, bevor du ihn festhältst.");
  }

  function handleDictation({ text, structured }: VoiceResult) {
    const decision = (structured as { decision?: { body?: string; rationale?: string } } | undefined)?.decision;
    setBody(decision?.body || text);
    if (decision?.rationale) setRationale(decision.rationale);
    setNote(
      decision
        ? "Eingesprochen und in Beschluss und Begründung aufgeteilt. Prüf den Text, bevor du ihn festhältst."
        : "Eingesprochen. Prüf den Text und ergänze die Begründung.",
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = decisionSchema.safeParse({ body, rationale, clusterRefs: refs });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const result = await apiFetch(`/api/rounds/${roundId}/decision`, { method: "POST", body: parsed.data });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-4 shadow-card sm:p-6"
    >
      {formError ? <FormError>{formError}</FormError> : null}

      <div className="flex flex-col gap-3 rounded-md bg-sunken p-3">
        <p className="text-body-sm text-ink-muted">
          Lass dir einen Vorschlag aus der Zusammenfassung machen oder sprich den Beschluss ein. Du prüfst und entscheidest.
        </p>
        <div className="flex flex-wrap items-start gap-3">
          {clusters.length > 0 ? (
            <Button type="button" variant="secondary" onClick={requestProposal} disabled={proposal.name === "loading"}>
              <Sparkles aria-hidden size={20} strokeWidth={1.75} />
              {proposal.name === "loading" ? "AsyncMeet formuliert …" : "Vorschlag von AsyncMeet"}
            </Button>
          ) : null}
          <VoiceRecorder
            endpoint={`/api/rounds/${roundId}/decision/voice`}
            label=""
            compact
            startLabel="Beschluss einsprechen"
            onTranscript={handleDictation}
          />
        </div>
        {proposal.name === "error" ? (
          <p role="alert" className="text-body-sm text-danger-ink">
            {proposal.message}
          </p>
        ) : null}
        {proposal.name === "shown" ? (
          proposal.proposals.length === 0 ? (
            <p role="status" className="text-body-sm text-ink">
              Die Zusammenfassung trägt keinen klaren Beschluss. Schreib ihn selbst oder starte eine Folgerunde.
            </p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Vorschläge von AsyncMeet">
              {proposal.proposals.map((p, i) => (
                <li key={i} className="flex flex-col gap-2 rounded-md border border-line bg-card p-3">
                  <p className="text-caption text-ink-muted">
                    Vorschlag {proposal.proposals.length > 1 ? i + 1 : ""} von AsyncMeet
                  </p>
                  <p className="text-body font-semibold text-ink">{p.body}</p>
                  <p className="text-body-sm text-ink">{p.rationale}</p>
                  <p className="text-body-sm text-ink-muted">
                    Stützt sich auf: {p.clusterRefs.map(titleOf).filter(Boolean).join(", ")}
                  </p>
                  <div>
                    <Button type="button" variant="secondary" onClick={() => takeOver(p)}>
                      <Check aria-hidden size={20} strokeWidth={1.75} />
                      Vorschlag übernehmen
                    </Button>
                  </div>
                </li>
              ))}
              {proposal.model ? <li className="font-mono text-xs text-ink-muted">{proposal.model}</li> : null}
            </ul>
          )
        ) : null}
        {note ? (
          <p role="status" className="text-body-sm text-ink">
            {note}
          </p>
        ) : null}
      </div>

      <TextAreaField
        id="decision-body"
        name="body"
        label="Beschluss"
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        hint="Was gilt ab jetzt? Kurz und konkret."
        error={errors.body}
      />
      <TextAreaField
        id="decision-rationale"
        name="rationale"
        label="Begründung"
        rows={5}
        maxLength={4000}
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        hint="Warum so? Geh auch auf Bedenken und Einzelstimmen ein. Alle im Team lesen das."
        error={errors.rationale}
      />
      {clusters.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-label">Worauf stützt sich der Beschluss? (optional)</legend>
          {clusters.map((c) => (
            <label
              key={c.index}
              className="flex min-h-11 items-center gap-3 rounded-md border border-line px-3 py-2 text-body-sm"
            >
              <input
                type="checkbox"
                name="clusterRefs"
                value={c.index}
                checked={refs.includes(c.index)}
                onChange={(e) => setRefs((r) => (e.target.checked ? [...r, c.index] : r.filter((x) => x !== c.index)))}
                className="size-5 accent-primary"
              />
              <span>
                <span className="font-semibold">{c.title}</span>
                <span className="text-ink-muted"> · {c.kindLabel}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <p className="text-body-sm text-ink-muted">
        Ihr entscheidet, AsyncMeet bereitet nur vor. Ein Beschluss lässt sich danach nicht mehr ändern.
      </p>
      <div>
        <Button type="submit" disabled={pending}>
          <Gavel aria-hidden size={20} strokeWidth={1.75} />
          {pending ? "Wird gespeichert …" : "Beschluss festhalten"}
        </Button>
      </div>
    </form>
  );
}
