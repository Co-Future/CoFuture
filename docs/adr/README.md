# Architekturentscheidungen (ADR)

Jede wichtige technische Entscheidung bekommt eine Datei `NNN-titel.md` mit:

- **Kontext:** Welches Problem, welche Optionen?
- **Entscheidung:** Was wir gewählt haben.
- **Folgen:** Was das für Code, Kosten und Datenschutz bedeutet.

## Übersicht

Eine ADR gilt, sobald Constantin oder Luca sie freigeben. Eine Zustimmung des ganzen Teams ist nicht nötig. Begründung und Kosten stehen in der jeweiligen ADR, das Gesamtbild in [Tech-Stack](../tech-stack.md) und [Architektur](../architecture.md). Neue ADR: Datei anlegen, Zeile unten ergänzen, betroffene Doku anpassen (die CI prüft die Übersicht).

| ADR | Thema | Entscheidung |
| --- | --- | --- |
| [001](001-web-framework-nextjs.md) | Web-Framework | Next.js 16 |
| [002](002-backend-datenbank-supabase.md) | Backend & Datenbank | Supabase (PostgreSQL, Frankfurt) |
| [003](003-hosting-vercel.md) | Hosting | Vercel Hobby, Region Frankfurt |
| [004](004-speech-to-text-groq-whisper.md) | Speech-to-Text | Whisper large-v3-turbo über Groq |
| [005](005-sprachmodell.md) | Sprachmodell | Gemini 3.5 Flash, Reserve Groq qwen |
| [006](006-vektorsuche-pgvector.md) | Vektorsuche | pgvector |
| [007](007-auslieferung-web-app-pwa.md) | Auslieferung | Web-App + PWA, kein Electron |
| [008](008-login-email-passwort.md) | Login | E-Mail + Passwort, Magic Link später |
| [009](009-hintergrundjobs-worker-vercel.md) | Hintergrundjobs | Worker als Next.js-Route, `pg_cron` |
| [010](010-api-route-handlers.md) | API-Stil | Route Handlers (REST) |
| [011](011-zugang-organisationen-einladungen.md) | Zugang | Organisationen + einmaliger Zugangslink |
| [012](012-austausch-mehrere-fragen.md) | Austausch | Mehrere Fragen, Zielpersonen, Rückfragen |
| [013](013-wissensspeicher.md) | Wissensspeicher | `knowledge_items`, Gemini Embedding, Hybridsuche |
