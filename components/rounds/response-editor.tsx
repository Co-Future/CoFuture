"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { VoiceRecorder } from "@/components/rounds/voice-recorder";
import { Button, FormError, TextAreaField } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { responseSchema } from "@/lib/validation/round";

type Props = { roundId: string; initialBody: string | null; pseudonym: string | null };

export function ResponseEditor({ roundId, initialBody, pseudonym }: Props) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody ?? "");
  const [source, setSource] = useState<"text" | "voice">("text");
  const [fromTranscript, setFromTranscript] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleTranscript = useCallback((text: string) => {
    setBody(text);
    setSource("voice");
    setFromTranscript(true);
    setStatus(null);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setStatus(null);
    const parsed = responseSchema.safeParse({ body, source });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setPending(true);
    const result = await apiFetch<{ pseudonym: string }>(`/api/rounds/${roundId}/response`, {
      method: "PUT",
      body: parsed.data,
    });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    setFromTranscript(false);
    setStatus(`Antwort gespeichert. Du erscheinst als ${result.data.pseudonym}.`);
    router.refresh();
  }

  const hint = fromTranscript
    ? "Prüf das Transkript und korrigier es bei Bedarf. Gespeichert wird erst mit dem Button."
    : pseudonym
      ? `Du erscheinst als ${pseudonym}. Bis zur Frist kannst du deine Antwort ändern.`
      : "Die anderen sehen deine Antwort erst nach der Frist und nur mit Pseudonym.";

  return (
    <div className="flex flex-col gap-4">
      <VoiceRecorder roundId={roundId} onTranscript={handleTranscript} />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        {formError ? <FormError>{formError}</FormError> : null}
        <TextAreaField
          id="response-body"
          name="body"
          label={fromTranscript ? "Transkript deiner Sprachantwort" : "Antwort als Text"}
          rows={6}
          maxLength={10000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          hint={hint}
          error={fieldError}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {initialBody ? "Antwort aktualisieren" : "Antwort speichern"}
          </Button>
          <p role="status" className="text-body-sm text-success-ink">
            {status}
          </p>
        </div>
      </form>
    </div>
  );
}
