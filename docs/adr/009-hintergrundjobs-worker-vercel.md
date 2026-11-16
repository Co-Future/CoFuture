# ADR 009: Hintergrundjobs mit Worker auf Vercel

**Status:** Vorgeschlagen, 12.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Transkription und KI-Analyse dauern zu lange für einen Request. Grenzen: Vercel-Funktion max. 300 s und 4,5 MB Body, Supabase Edge Function max. 150 s (Free) und Deno statt Node.js.

## Entscheidung

- Tabelle `analysis_jobs` als Queue.
- Worker als Next.js-Route auf Vercel, abgesichert mit `WORKER_SECRET`, jede Minute von `pg_cron` per `pg_net` angestoßen.
- Arbeit in kleinen Schritten: transcribe (pro Audiostück) → extract → cluster/assess → Ergebnis.
- Audio geht direkt aus dem Browser in Supabase Storage (signierte URL), nie durch eine Vercel-Funktion.

## Folgen

- Eine Laufzeit, KI-Code nur einmal geschrieben, lokal mit `pnpm dev` testbar.
- Längere Aufnahmen bleiben möglich.
- Wird es zu groß, zieht nur der Worker auf einen dauerhaften Container um; der Rest bleibt.
