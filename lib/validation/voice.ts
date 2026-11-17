import { z } from "zod";

export const VOICE_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"] as const;
export const MAX_RECORDING_MS = 120_000;

/** Base type without codec parameters: "audio/webm;codecs=opus" → "audio/webm". */
export function baseMime(mime: string): string {
  return mime.split(";")[0]!.trim().toLowerCase();
}

export const voiceJobSchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|ogg|mp4|mpeg|wav)$/, "Ungültiger Dateipfad."),
  mime: z.enum(VOICE_MIME_TYPES, "Dieses Audioformat wird nicht unterstützt."),
  durationMs: z.number().int().positive().max(MAX_RECORDING_MS + 5_000, "Die Aufnahme ist länger als 2 Minuten."),
});

export type VoiceJobInput = z.infer<typeof voiceJobSchema>;
