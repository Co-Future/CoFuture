# API

REST-Endpunkte als Next.js Route Handlers (ADR 010). Alle erwarten eine angemeldete Session (Cookie) und antworten mit JSON. Den Zugriff prüft zusätzlich die Datenbank per RLS.

## Fehlerformat

Jeder Fehler hat dieselbe Form:

```json
{ "error": { "code": "validation_failed", "message": "Bitte prüf deine Eingaben.", "fields": { "name": "Gib einen Teamnamen ein." } } }
```

`message` ist für Nutzer gedacht (Deutsch), `code` für den Code, `fields` nur bei Eingabefehlern.

| Code | Status | Bedeutung |
| --- | --- | --- |
| `unauthenticated` | 401 | Nicht angemeldet |
| `invalid_json`, `validation_failed` | 400 | Anfrage fehlerhaft |
| `forbidden` | 403 | Keine Berechtigung |
| `not_found`, `user_not_found` | 404 | Nicht vorhanden bzw. kein Konto zu dieser E-Mail |
| `already_member`, `last_lead`, `round_closed`, `invalid_status` | 409 | Konflikt mit dem aktuellen Zustand |

## Teams

| Methode | Pfad | Body | Antwort | Wer |
| --- | --- | --- | --- | --- |
| `POST` | `/api/teams` | `{ "name": string }` | `201 { id, name }` | alle Angemeldeten, werden Leitung |
| `POST` | `/api/teams/{teamId}/members` | `{ "email": string }` | `201 { status: "added" }` | Leitung |
| `DELETE` | `/api/teams/{teamId}/members/{userId}` | – | `204` | Leitung (beliebige Mitglieder), alle (sich selbst) |

## Runden und Antworten

| Methode | Pfad | Body | Antwort | Wer |
| --- | --- | --- | --- | --- |
| `POST` | `/api/teams/{teamId}/rounds` | `{ "question": string, "context"?: string, "deadline": ISO-8601 }` | `201 { id }` | Mitglieder des Teams |
| `PATCH` | `/api/rounds/{roundId}` | `{ "status": "closed" }` | `200 { id, status }` | wer die Runde gestartet hat, Leitung |
| `PUT` | `/api/rounds/{roundId}/response` | `{ "body": string, "source"?: "text" \| "voice" }` | `201` bzw. `200 { pseudonym }` | Mitglieder, bis zur Frist |

Regeln in der Datenbank: Die Frage ist nach der ersten Antwort gesperrt, Fristen lassen sich nur in die Zukunft verschieben, Status nur `open → closed → decided`. `pg_cron` schließt Runden jede Minute nach Fristende. Andere Antworten sind erst nach dem Schließen sichtbar, über die View `round_responses` ohne Personenbezug.

## Sprachantworten

Ablauf (ADR 009): Der Browser lädt die Aufnahme **direkt** in den privaten Bucket `voice` unter `{userId}/{uuid}.{ext}` (nie durch eine Vercel-Funktion), dann:

| Methode | Pfad | Body | Antwort | Wer |
| --- | --- | --- | --- | --- |
| `POST` | `/api/rounds/{roundId}/voice` | `{ "path": string, "mime": string, "durationMs": number }` | `202 { jobId }` | Mitglieder, offene Runde, eigene Datei |
| `POST` | `/api/jobs/{jobId}/retry` | – | `202` | wer den Auftrag angelegt hat, nach Fehler, max. 3 Versuche |
| `POST` | `/api/worker` | – (Header `Authorization: Bearer WORKER_SECRET`) | `200 { transcribe, sweptAudio }` | nur Server/pg_cron |

Der Auftrag startet direkt nach der Antwort (`after()`). Der Worker transkribiert (Groq, Reserve Gemini), schreibt den Text in `analysis_jobs.result` und löscht das Audio. Den Status liefert Supabase Realtime an die Person, die den Auftrag angelegt hat. Erst wenn sie das (korrigierte) Transkript speichert, wird es eine Antwort mit `source: "voice"`. Audio, das länger als 24 Stunden liegt, räumt `/api/worker` weg.

Lesen (Teams, Mitglieder, Runden, Antworten) läuft direkt in Server Components über Supabase mit RLS, ohne eigenen Endpunkt.
