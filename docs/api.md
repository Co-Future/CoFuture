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
| `PUT` | `/api/rounds/{roundId}/response` | `{ "body": string }` | `201` bzw. `200 { pseudonym }` | Mitglieder, bis zur Frist |

Regeln in der Datenbank: Die Frage ist nach der ersten Antwort gesperrt, Fristen lassen sich nur in die Zukunft verschieben, Status nur `open → closed → decided`. `pg_cron` schließt Runden jede Minute nach Fristende. Andere Antworten sind erst nach dem Schließen sichtbar, über die View `round_responses` ohne Personenbezug.

Lesen (Teams, Mitglieder, Runden, Antworten) läuft direkt in Server Components über Supabase mit RLS, ohne eigenen Endpunkt.
