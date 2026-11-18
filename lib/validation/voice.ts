import { z } from "zod";

export const VOICE_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"] as const;
/** 10 minutes: enough to answer several questions in one go. At 32 kbit/s that is about 2,4 MB. */
export const MAX_RECORDING_MS = 600_000;

/** Base type without codec parameters: "audio/webm;codecs=opus" → "audio/webm". */
export function baseMime(mime: string): string {
  return mime.split(";")[0]!.trim().toLowerCase();
}

export const voiceJobSchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|ogg|mp4|mpeg|wav)$/, "Ungültiger Dateipfad."),
  mime: z.enum(VOICE_MIME_TYPES, "Dieses Audioformat wird nicht unterstützt."),
  durationMs: z.number().int().positive().max(MAX_RECORDING_MS + 5_000, "Die Aufnahme ist länger als 10 Minuten."),
});

export type VoiceJobInput = z.infer<typeof voiceJobSchema>;

/** Dictated questions for a new exchange: replace all questions or reconcile with the ones so far. */
export const questionsVoiceJobSchema = voiceJobSchema.extend({
  mode: z.enum(["replace", "merge"]).default("replace"),
  questions: z
    .array(z.object({ key: z.string().min(1).max(64), body: z.string().max(500), targets: z.array(z.uuid()).max(200) }))
    .max(50)
    .default([]),
});

/** Spoken answer: "all" lets AsyncMeet split it across your questions, "question" is for one card. */
export const answerVoiceJobSchema = voiceJobSchema.extend({
  scope: z.enum(["all", "question"]).default("all"),
  /** With scope "question": the card the recording belongs to. AsyncMeet summarises it for that question. */
  questionId: z.uuid().optional(),
});

export type QuestionsVoiceJobInput = z.input<typeof questionsVoiceJobSchema>;
