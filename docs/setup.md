# Einrichten

Zugänge, erster Start und lokale Entwicklung. Wer eine Umgebungsvariable, einen Befehl oder einen Zugang ändert, passt diese Datei und `.env.example` im selben PR an.

**Inhalt:** [Neu im Team](#neu-im-team) · [Lokal einrichten](#lokal-einrichten) · [Umgebungsvariablen](#umgebungsvariablen) · [Befehle](#befehle)

## Neu im Team

**Nur anschauen und Feedback geben:** Die Live-Version läuft auf Vercel (Adresse bei Luca oder Constantin). Testkonten für das Team gibt es ebenfalls dort, nicht im Repo. Feedback als GitHub-Issue oder direkt an Luca oder Constantin.

**Mitentwickeln:** Diese Zugänge brauchst du, bevor `pnpm dev` alles kann:

| Was | Wie | Von wem |
| --- | --- | --- |
| GitHub | Mitglied der Organisation `Co-Future` | Luca oder Constantin laden ein |
| Supabase | Einladung in die Organisation, Rolle Developer (Projekt `cofuture-staging`) | Luca lädt ein |
| Supabase-Werte | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` und ein eigener `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API Keys → Secret keys, einer pro Person) | Luca schickt sie privat |
| Groq-Key | selbst anlegen: [console.groq.com](https://console.groq.com) → API Keys → Create API Key (kostenlos) | du |
| Gemini-Key | selbst anlegen: [aistudio.google.com](https://aistudio.google.com) → Get API key → Create API key (kostenlos) | du |
| Vercel | nicht nötig. Jeder PR bekommt automatisch eine Vorschau-URL. | – |

Eigene KI-Keys, weil die Gratis-Kontingente pro Konto zählen und jeder Key einzeln gesperrt werden kann. Keys und Passwörter nie ins Repo, in Issues oder in Gruppenchats.

**Erster Start:**

1. Node.js 22 installieren ([nodejs.org](https://nodejs.org), LTS). Fehlt danach `corepack`, einmal `npm install -g corepack`.
2. Repo klonen und einrichten (siehe [Lokal einrichten](#lokal-einrichten)), Werte in `.env.local` eintragen. `WORKER_SECRET` ist ein beliebiger Zufallswert mit mindestens 16 Zeichen.
3. `corepack pnpm dev` starten, auf http://localhost:3000 eine Organisation anlegen (Registrieren), ein Team und eine Runde anlegen.
4. `corepack pnpm test` und `corepack pnpm test:integration` müssen grün sein. Dann passt die Einrichtung.
5. Mit Claude Code: im Repo-Ordner starten, es liest `CLAUDE.md` von selbst. Guter Einstieg: „Lies README.md, docs/README.md und docs/architecture.md und erklär mir, wie eine Runde technisch abläuft.“
6. Für jede Aufgabe einen Branch, dann PR (siehe [Mitmachen](../README.md#mitmachen)).

## Lokal einrichten

Voraussetzungen: Node.js 22 (`.nvmrc`), pnpm über corepack, Zugang zum Supabase-Projekt `cofuture-staging`.

```bash
git clone https://github.com/Co-Future/CoFuture.git
cd CoFuture
corepack pnpm install
cp .env.example .env.local
corepack pnpm dev            # http://localhost:3000
```

## Umgebungsvariablen

Werte für `.env.local` kommen aus den Dashboards von Supabase, Groq und Gemini, nie ins Repo:

| Variable | Wofür | Pflicht |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Login, Daten lesen und schreiben | ja |
| `SUPABASE_SECRET_KEY` | Jobs, Worker, Personen anlegen, Zugangslinks (nur Server) | für Sprache, Karte, Organisationen |
| `GROQ_API_KEY` | Transkription, Reserve-LLM | für Sprache |
| `GEMINI_API_KEY` | Perspektivenkarte | für die Karte (sonst nur Groq) |
| `LLM_PROVIDER` | `groq` stellt Groq vor Gemini | nein |
| `WORKER_SECRET` | Schutz für `/api/worker`, mindestens 16 Zeichen | nein |

## Befehle

| Befehl | Zweck |
| --- | --- |
| `pnpm dev` | Dev-Server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Routen-Typen erzeugen und TypeScript prüfen |
| `pnpm test` | Unit-Tests, ohne Netz |
| `pnpm test:integration` | Tests gegen Staging (legt Wegwerf-Nutzer an und löscht sie danach wieder) |
| `pnpm build` | Produktions-Build |
| `pnpm docs:check` | Doku, Version und Changelog prüfen (läuft auch in der CI) |
| `pnpm db:push` | Migrationen nach Staging spielen (braucht `supabase login`) |
| `pnpm db:types` | `lib/db/types.ts` aus Staging neu erzeugen |

> **Repo im iCloud-Ordner?** iCloud lagert Dateien aus `node_modules` aus, dann hängen Lint und Build. Abhilfe steht in [`CLAUDE.md`](../CLAUDE.md#repo-im-icloud-ordner). Besser: außerhalb von iCloud klonen.
