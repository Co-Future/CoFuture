# ADR 005: Sprachmodell Gemini 3.5 Flash, Groq als Gratis-Reserve

**Status:** Vorgeschlagen, 12.11.2026, nach PoC geändert am 16.11.2026 (Freigabe durch Constantin oder Luca)

## Kontext

Die Perspektivenkarte braucht ein LLM mit Structured Output (JSON-Schema). Budget: unter 50 € gesamt. Ursprünglich vorgeschlagen war Mistral (gratis, EU); das Anlegen eines API-Keys schlug fehl. Im PoC verglichen: Groq gpt-oss-120b, Groq qwen3.8-27b, Gemini 3.5 Flash, Gemini 3.5 Flash-Lite.

## Entscheidung

**Gemini 3.5 Flash** für die Perspektivenkarte, **Groq qwen3.8-27b** als kostenlose Reserve. Alles hinter dem Adapter in `lib/ai/`.

- **Während der Entwicklung (bis Anfang Januar 2027): Gemini-Gratistarif.** Es gibt noch keine echten Nutzer, und es gehen nur ausgedachte Testdaten an die KI.
- **Vor dem ersten Einsatz mit echten Menschen (Usability-Test ab 13.01.2027, Abschluss-Demo): auf den bezahlten Tarif umstellen.** Google-Cloud-Abrechnung mit Ausgabenlimit 5–10 €. Im Code ändert sich nichts.
- Der Adapter weicht bei Limit (429) oder Überlastung (503) automatisch auf Groq aus. Automatische Tests laufen gegen Groq, damit das Gemini-Kontingent nicht verbraucht wird.

PoC (`eval/poc/REPORT.md`): Alle Modelle halten das Schema ein, decken alle Antworten ab, erfinden keine Quell-IDs und erkennen den Prompt-Injection-Versuch. Nur Gemini 3.5 Flash hielt die Einzelstimme in allen Läufen sichtbar (Gestaltungsprinzip „Minderheiten sichtbar“) und formulierte brauchbare offene Fragen. Groq gpt-oss ließ die Einzelstimme in allen Läufen untergehen; Flash-Lite missverstand Ironie.

## Folgen

- Gemini-Nutzungsbedingungen: Für Anwendungen, die Nutzern im EWR zur Verfügung stehen, sind nur bezahlte Dienste zulässig. Deshalb die Umstellung vor echten Nutzern; die Kosten liegen bei Cent-Beträgen pro Analyse. Im EWR gelten auch für das Gratis-Kontingent die Datenregeln der bezahlten Dienste (kein Training mit unseren Daten).
- Latenz: 17–46 s pro Aufruf. Die Analyse läuft ohnehin als Job im Worker (ADR 009); für das Ziel „30 Antworten unter 60 s“ die Pipeline-Schritte schlank halten.
- Gratis-Limits für Gemini 3.5 Flash sind knapp (einige Dutzend Aufrufe pro Tag, aktuelle Werte in AI Studio unter „Rate limits“).
- Prompt v1 per Prompt-Tuning auch für die Groq-Reserve so verbessern, dass Einzelstimmen sichtbar bleiben.
- Jede Analyse speichert Modell und `prompt_version`.
