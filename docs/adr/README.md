# Architekturentscheidungen (ADR)

Jede wichtige technische Entscheidung bekommt eine Datei `NNN-titel.md` mit:

- **Kontext:** Welches Problem, welche Optionen?
- **Entscheidung:** Was wir gewählt haben.
- **Folgen:** Was das für Code, Kosten und Datenschutz bedeutet.

## Übersicht

Stand 12.11.2026: alle vorgeschlagen, Zustimmung im Team bis zum Architektur-Review (M3, 03.12.2026). Begründung, Kosten und Gesamtbild stehen in Notion auf der Seite *Architektur-Vorschlag* unter *Technologieentscheidung & Proof of Concept*.

| ADR | Thema | Entscheidung |
| --- | --- | --- |
| [001](001-web-framework-nextjs.md) | Web-Framework | Next.js 16 |
| [002](002-backend-datenbank-supabase.md) | Backend & Datenbank | Supabase (PostgreSQL, Frankfurt) |
| [003](003-hosting-vercel.md) | Hosting | Vercel Hobby, Region Frankfurt |
| [004](004-speech-to-text-groq-whisper.md) | Speech-to-Text | Whisper large-v3 über Groq |
| [005](005-sprachmodell-mistral.md) | Sprachmodell | Mistral, Reserve Claude/OpenAI |
| [006](006-vektorsuche-pgvector.md) | Vektorsuche | pgvector |
| [007](007-auslieferung-web-app-pwa.md) | Auslieferung | Web-App + PWA, kein Electron |
| [008](008-login-email-passwort.md) | Login | E-Mail + Passwort, Magic Link später |
| [009](009-hintergrundjobs-worker-vercel.md) | Hintergrundjobs | Worker als Next.js-Route, `pg_cron` |
| [010](010-api-route-handlers.md) | API-Stil | Route Handlers (REST) |
