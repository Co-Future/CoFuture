# ADR 004: Speech-to-Text mit Whisper über Groq

**Status:** Vorgeschlagen, 12.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Sprachantworten müssen auf Deutsch transkribiert werden. Optionen: OpenAI Whisper-API (ca. 0,006 USD/Min.), Whisper über Groq (Gratis-Tarif), selbst gehostet.

## Entscheidung

Whisper large-v3 über Groq, hinter dem Adapter in `lib/stt/`. OpenAI Whisper als Reserve.

## Folgen

- Gratis-Grenzen: 20 Anfragen/Min., 2.000/Tag, 2 Std. Audio pro Stunde. Reicht fürs Projekt.
- Datei max. 25 MB: Aufnahme in Sprachqualität (ca. 32 kbit/s), längere Aufnahmen in Stücke schneiden.
- Groq ist ein US-Anbieter: nur ausgedachte Testdaten.
- Qualität auf Deutsch im PoC messen.
