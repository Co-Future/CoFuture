"use client";

import { Gavel } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, FormError, TextAreaField } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { fieldErrors } from "@/lib/validation/auth";
import { decisionSchema } from "@/lib/validation/decision";

type Props = {
  roundId: string;
  /** Clusters of the perspective map, by their position in the map. */
  clusters: { index: number; title: string; kindLabel: string }[];
};

/** A person writes the decision with a rationale. The map is only referenced, never decides. */
export function DecisionForm({ roundId, clusters }: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<Partial<Record<"body" | "rationale", string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const parsed = decisionSchema.safeParse({
      body: form.get("body"),
      rationale: form.get("rationale"),
      clusterRefs: form.getAll("clusterRefs").map(Number),
    });
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 rounded-lg border border-line bg-card p-4 shadow-card sm:p-6">
      {formError ? <FormError>{formError}</FormError> : null}
      <TextAreaField
        id="decision-body"
        name="body"
        label="Beschluss"
        rows={3}
        maxLength={2000}
        hint="Was gilt ab jetzt? Kurz und konkret."
        error={errors.body}
      />
      <TextAreaField
        id="decision-rationale"
        name="rationale"
        label="Begründung"
        rows={5}
        maxLength={4000}
        hint="Warum so? Geh auch auf Bedenken und Einzelstimmen ein. Alle im Team lesen das."
        error={errors.rationale}
      />
      {clusters.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-label">Worauf stützt sich der Beschluss? (optional)</legend>
          {clusters.map((c) => (
            <label key={c.index} className="flex min-h-11 items-center gap-3 rounded-md border border-line px-3 py-2 text-body-sm">
              <input type="checkbox" name="clusterRefs" value={c.index} className="size-5 accent-primary" />
              <span>
                <span className="font-semibold">{c.title}</span>
                <span className="text-ink-muted"> · {c.kindLabel}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <p className="text-body-sm text-ink-muted">
        Ihr entscheidet, AsyncMeet hat nur zusammengefasst. Ein Beschluss lässt sich danach nicht mehr ändern.
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
