# ADR 004: Speech-to-Text mit Whisper über Groq

**Status:** Vorgeschlagen, 12.11.2026, nach PoC aktualisiert am 16.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Sprachantworten müssen auf Deutsch transkribiert werden. Optionen: OpenAI Whisper-API (ca. 0,006 USD/Min.), Whisper über Groq (Gratis-Tarif), Gemini (versteht Audio direkt), selbst gehostet.

## Entscheidung

**Whisper large-v3-turbo über Groq**, hinter dem Adapter in `lib/stt/`. Gemini 3.5 Flash als Reserve.

PoC (`eval/poc/REPORT.md`, 45 s Testaudio): turbo 0,5 s und 2,3 % Wortfehler; large-v3 0,8 s und 4,7 %; Gemini 3.5 Flash 15 s und 0,8 %; Gemini Flash-Lite machte einen Sinnfehler bei einer Uhrzeit.

## Folgen

- Gratis-Grenzen: 20 Anfragen/Min., 2.000/Tag, 2 Std. Audio pro Stunde. Reicht fürs Projekt.
- Datei max. 25 MB: Aufnahme in Sprachqualität (ca. 32 kbit/s, 45 s ≈ 180 KB), längere Aufnahmen in Stücke schneiden.
- Groq ist ein US-Anbieter: nur ausgedachte Testdaten.
- Echte Handyaufnahmen mit Störgeräuschen noch nachtesten.
