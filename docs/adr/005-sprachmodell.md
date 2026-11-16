# ADR 005: Sprachmodell Gemini 3.5 Flash, Groq als Gratis-Reserve

**Status:** Vorgeschlagen, 12.11.2026, nach PoC geändert am 16.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Die Perspektivenkarte braucht ein LLM mit Structured Output (JSON-Schema). Budget: unter 50 € gesamt. Ursprünglich vorgeschlagen war Mistral (gratis, EU); das Anlegen eines API-Keys schlug fehl. Im PoC verglichen: Groq gpt-oss-120b, Groq qwen3.8-27b, Gemini 3.5 Flash, Gemini 3.5 Flash-Lite.

## Entscheidung

**Gemini 3.5 Flash im bezahlten Tarif** für die Perspektivenkarte. **Groq qwen3.8-27b** als kostenlose Reserve und für Entwicklung und Tests. Alles hinter dem Adapter in `lib/ai/`.

PoC (`eval/poc/REPORT.md`): Alle Modelle halten das Schema ein, decken alle Antworten ab, erfinden keine Quell-IDs und erkennen den Prompt-Injection-Versuch. Nur Gemini 3.5 Flash hielt die Einzelstimme in allen Läufen sichtbar (Gestaltungsprinzip „Minderheiten sichtbar“) und formulierte brauchbare offene Fragen. Groq gpt-oss ließ die Einzelstimme in allen Läufen untergehen; Flash-Lite missverstand Ironie.

## Folgen

- Gemini-Nutzungsbedingungen: Für Anwendungen mit Nutzern im EWR sind nur bezahlte Dienste zulässig. Dafür braucht es ein Google-Cloud-Konto mit Abrechnung und ein Ausgabenlimit; die Kosten liegen bei Cent-Beträgen pro Analyse. Im EWR gelten auch für das Gratis-Kontingent die Datenregeln der bezahlten Dienste (kein Training mit unseren Daten).
- Latenz: 17–46 s pro Aufruf. Die Analyse läuft ohnehin als Job im Worker (ADR 009); für das Ziel „30 Antworten unter 60 s“ die Pipeline-Schritte schlank halten.
- Prompt v1 per Prompt-Tuning auch für die Groq-Reserve so verbessern, dass Einzelstimmen sichtbar bleiben.
- Jede Analyse speichert Modell und `prompt_version`.
