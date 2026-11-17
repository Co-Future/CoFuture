"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";
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

  // Latest text for the transcript callback, without re-subscribing the recorder on every keystroke.
  const bodyRef = useRef(initialBody ?? "");
  const updateBody = (value: string) => {
    bodyRef.current = value;
    setBody(value);
  };

  const save = useCallback(
    async (text: string, from: "text" | "voice", savedMessage: (pseudonym: string) => string) => {
      setFormError(null);
      setStatus(null);
      const parsed = responseSchema.safeParse({ body: text, source: from });
      if (!parsed.success) {
        setFieldError(parsed.error.issues[0]?.message);
        return false;
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
        return false;
      }
      setStatus(savedMessage(result.data.pseudonym));
      router.refresh();
      return true;
    },
    [roundId, router],
  );

  // A transcript is appended to what is already there (a second recording or typed notes stay)
  // and saved at once: the audio is deleted after transcription, so nothing may hang unsaved.
  const handleTranscript = useCallback(
    (text: string) => {
      const current = bodyRef.current.trim();
      const merged = current ? `${current}\n\n${text}` : text;
      bodyRef.current = merged;
      setBody(merged);
      setSource("voice");
      setFromTranscript(true);
      void save(merged, "voice", () => "Transkript gespeichert. Prüf es und korrigier es bei Bedarf.");
    },
    [save],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await save(body, source, (pseudonym) => `Antwort gespeichert. Du erscheinst als ${pseudonym}.`)) setFromTranscript(false);
  }

  const hint = fromTranscript
    ? "Das Transkript ist gespeichert. Korrigierst du etwas, speichere es erneut."
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
          label={fromTranscript ? "Deine Antwort mit Transkript" : "Antwort als Text"}
          rows={6}
          maxLength={10000}
          value={body}
          onChange={(event) => updateBody(event.target.value)}
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
