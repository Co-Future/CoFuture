# PoC: KI-Anbieter im Vergleich (16.11.2026)

Wegwerf-Test für ADR 004 und 005. Alle Daten sind ausgedacht (`data.ts`). Erneut ausführen: `node --experimental-strip-types eval/poc/run.ts` (Keys in `.env.local`).

**Ergebnis in einem Satz:** Für die Transkription ist Groq Whisper large-v3-turbo schnell, genau und gratis. Für die Perspektivenkarte liefert Gemini 3.5 Flash die beste Qualität und hält als einziges Modell die Einzelstimme in allen Läufen sichtbar, ist aber langsam (17–46 s) und für EU-Nutzer nur im bezahlten Tarif zulässig.

Mistral ist nicht dabei: Das Anlegen eines API-Keys schlug fehl.

## Speech-to-Text

Testaudio: 45 s gesprochene Antwort (per Gemini-TTS erzeugt), Opus 32 kbit/s, 180 KB. Wortfehlerrate gegen den Originaltext.

| Anbieter / Modell | Dauer | Wortfehlerrate | Auffällig |
| --- | --- | --- | --- |
| Groq whisper-large-v3-turbo | 0,5 s | 2,3 % | nur Schreibweisen („Viertagewoche“) |
| Groq whisper-large-v3 | 0,8 s | 4,7 % | „Kundenmikration“, „2.“ statt „Zweitens“ |
| Gemini 3.5 Flash | 15,2 s | 0,8 % | fast fehlerfrei |
| Gemini 3.5 Flash-Lite | 3,3 s | 5,4 % | **Sinnfehler:** „Kita um 1:30 Uhr“ statt „um halb fünf“ |

## Perspektivenkarte

15 Antworten, darunter eine ironische (R05), eine Einzelstimme (R07, Teilzeit), ein Prompt-Injection-Versuch (R13) und eine themenfremde (R15). Je 3 Läufe, Ausgabe gegen Zod-Schema geprüft.

| Anbieter / Modell | Dauer | Schema | Abdeckung | Erfundene IDs | Injection R13 | Einzelstimme R07 | Ironie R05 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Groq gpt-oss-120b | 2–3 s | 3/3 ok | 100 % | 0 | 3/3 erkannt | **0/3** sichtbar (in „Bedenken“ untergegangen) | richtig |
| Groq qwen3.8-27b | 2 s | 3/3 ok | 100 % | 0 | 3/3 erkannt | 1/3 sichtbar | richtig |
| Gemini 3.5 Flash | 17–46 s | 3/3 ok | 100 % | 0 | 3/3 erkannt | **3/3** sichtbar | richtig |
| Gemini 3.5 Flash-Lite | 2 s | 2/2 ok, 1× überlastet (503) | 93–100 % | 0 | 2/2 erkannt | 2/2 sichtbar | **falsch** (als „themenfremd“ einsortiert) |

Weitere Beobachtungen:

- Alle Modelle halten das JSON-Schema ein und erfinden keine Quell-IDs.
- Nur die Gemini-Modelle formulieren brauchbare offene Fragen; gpt-oss und qwen lassen sie meist leer.
- Gemini 3.5 Flash ordnete R14 („Zustimmung, wenn der Freitag rotiert“) einmal unter Bedenken ein. Fehler dieser Art fängt die Quellenansicht ab, weil jede Aussage auf die Originalantworten verweist.

## Grenzen des Tests

- Das Audio ist synthetisch und sauber. Echte Handyaufnahmen mit Hall und Hintergrundgeräuschen müssen wir nachtesten.
- Ein Datensatz, je 3 Läufe: Tendenzen, keine Statistik. Das Golden Dataset (Arbeitspaket KI-Evaluation) ersetzt diesen Test.
- Der Prompt ist v1. Die Einzelstimme lässt sich vermutlich auch bei den Groq-Modellen per Prompt-Tuning sichtbar machen.

## Empfehlung

| Aufgabe | Empfehlung | Reserve |
| --- | --- | --- |
| Transkription | Groq whisper-large-v3-turbo (gratis, 2.000 Anfragen/Tag) | Gemini 3.5 Flash |
| Perspektivenkarte | Gemini 3.5 Flash, bezahlter Tarif (Cent-Beträge pro Analyse, erfüllt die EU-Nutzungsbedingungen) | Groq qwen3.8-27b, gratis, mit Prompt-Tuning |
| Entwicklung und Tests | Groq (großzügige Gratis-Limits) | – |
