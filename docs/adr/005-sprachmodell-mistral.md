# ADR 005: Sprachmodell Mistral, Reserve Claude oder OpenAI

**Status:** Vorgeschlagen, 12.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Die Perspektivenkarte braucht ein LLM mit Structured Output (JSON-Schema). Budget: unter 50 € gesamt. Optionen: Claude, OpenAI, Mistral, Gemini.

## Entscheidung

Mistral im Experiment-Tarif (gratis, EU-Anbieter), Training-Nutzung im Admin Console abgeschaltet. Claude oder OpenAI als Reserve mit Ausgabenlimit. Alles hinter dem Adapter in `lib/ai/`.

## Folgen

- 1 Anfrage pro Sekunde: mehrere Antworten pro Aufruf bündeln, damit 30 Antworten unter 60 s bleiben.
- Offene Modelle sind bei deutschem Text und JSON evtl. schwächer: im PoC gegen Claude/OpenAI vergleichen.
- Gemini verworfen wegen unklarer Datenschutzlage im Gratis-Tarif.
- Jede Analyse speichert Modell und `prompt_version`.
