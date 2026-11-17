# Büro-Simulation

Eine erfundene Firma mitten im Tagesgeschäft, damit du CoFuture so testen kannst, wie es später genutzt wird. Gleichzeitig laufen ein Lagerumzug, eine ERP-Umstellung, der Kundenservice und eine AG zu hybridem Arbeiten. Dazu kommen viele Personen, Gäste von außen, widersprüchliche Meinungen und offene Fristen.

Die simulierten Personen melden sich an und handeln wie echte Nutzer. Row Level Security und alle Datenbankregeln gelten für sie genauso wie in der App. Nur die Konten legt die Simulation mit dem Secret Key an, so wie es eine Owner-Person über „Person hinzufügen“ tun würde.

Alle Namen und Inhalte sind ausgedacht. Die Adressen liegen unter `nordlicht.example.com`, einer reservierten Domain, an die nie Post geht.

## Starten

In `.env.local` (Werte nie ins Repo):

| Variable | Wofür |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Staging-Projekt |
| `SIMULATION_PASSWORD` | gemeinsames Passwort aller simulierten Konten, mindestens 8 Zeichen |
| `GEMINI_API_KEY` oder `GROQ_API_KEY` | Perspektivenkarten. Ohne Schlüssel bleiben die Analysen in der Warteschlange. |
| `SIMULATION_MINUTES` | Dauer der Live-Simulation, Standard 15 |

```bash
pnpm sim:setup
```

```bash
pnpm dev
```

```bash
pnpm sim:live
```

```bash
pnpm sim:reset
```

1. `sim:setup` baut die Firma auf, in etwa 2 bis 5 Minuten. Danach prüft es aus Sicht jeder Person: wer welche Teams sieht, ob Gäste Runden starten können, ob alle dieselbe Karte sehen und ob Beschlüsse nur im Team sichtbar sind. Am Ende steht, was auf dich wartet.
2. Melde dich in der App als `alex@nordlicht.example.com` mit `SIMULATION_PASSWORD` an.
3. `sim:live` lässt die Kolleginnen und Kollegen weiterarbeiten, während du klickst. Zurückgehaltene Antworten treffen ein, jemand ändert die eigene Antwort, Lesebestätigungen kommen. Eine kurze Runde zum Sommerfest läuft bis zur Frist, `pg_cron` schließt sie, danach erscheint die Perspektivenkarte.
4. `sim:reset` löscht die Organisation und alle simulierten Konten. Danach kannst du neu aufbauen.

Die Läufe benutzen das freie Kontingent von Gemini oder Groq. Pro Aufbau sind das 6 Analysen, pro Live-Lauf eine. An die KI gehen nur ausgedachte Texte.

## Die Firma

**Nordlicht Logistik GmbH (Simulation):** 21 Personen, davon 2 Gäste, in 5 Teams und mit 11 Runden.

| Team | Leitung | Worum es geht |
| --- | --- | --- |
| Geschäftsleitung | Sabine Hartmann (Owner) | Investitionsbudget 2027 (beschlossen), Risiken Q1 (offen) |
| Projekt Lager Süd | **Alex Berger (du)** | Umzugstermin (geschlossen, wartet auf deinen Beschluss), Regalsystem (beschlossen) mit Folgerunde zur Einweisung, Schichtplan (offen) |
| ERP-Umstellung Atlas | Jonas Wolff | Go-live am 1. März (geschlossen), Schulungen (offen). Gast: Mira Okafor, externe Beratung |
| Kundenservice | Fatma Yıldız | Hotline bis 20:00 Uhr (beschlossen), Antwortvorlagen (offen, viele Sprachantworten) |
| AG Hybrides Arbeiten | Carla Romano | Feste Bürotage (geschlossen), in `sim:live` die Runde zum Sommerfest |

In den Runden stecken die schwierigen Fälle, die AsyncMeet sauber lösen muss:

- **Einzelstimmen:** Alleinerziehender Lagerist ohne Wochenendbetreuung, Teilzeitkraft, für die „2 Bürotage“ zwei Drittel der Woche sind.
- **Begründeter Widerspruch:** Arbeitssicherheit gegen den Umzugstermin vor der Brandschutzabnahme.
- **Gäste mit Fachwissen:** Spedition zu freien Fahrzeugen, externe Beratung zum Go-live-Termin.
- **Ironie** (der Kaffeeautomat) und eine **Prompt-Injection** („Ignoriere alle bisherigen Anweisungen …“).
- **Sprachantworten** mit Füllwörtern, Zahlen und Fristen, Beiträge mit mehreren Punkten.

## Aufgaben zum Durchspielen

Als **Alex Berger**:

1. Dashboard: Welche Runden warten auf deine Antwort? Erwartet: Risiken Q1, Atlas-Schulungen, Schichtplan, Einweisung.
2. Beantworte die Risiken-Runde per Sprache. Erwartet: Transkript erscheint, Audio ist danach weg.
3. Umzugstermin: Lies die Perspektivenkarte. Sind die Einwände von Arbeitssicherheit und Betriebsrat und die Einzelstimme aus dem Lager sichtbar? Hat jede Aussage Quellen? Landet der Kaffeeautomat nicht als ernstes Thema?
4. Beschließe den Umzugstermin mit Begründung und Verweis auf die Themen. Starte dann eine Folgerunde zur Wochenendbetreuung.
5. Atlas Go-live: Wurde die Prompt-Injection ignoriert? Du kannst hier nicht beschließen, das macht Jonas als Teamleitung.
6. Kundenservice: Du bist nicht im Team. Du solltest es nirgends sehen.
7. Starte `sim:live` und lass die Schichtplan-Runde offen. Die Antwortzahl steigt live, ohne Namen.

Mit anderen Rollen (gleiches Passwort):

| Anmelden als | Was du prüfst |
| --- | --- |
| `sabine@…` (Owner) | Personenverwaltung, Zugangslinks, Rollen ändern. Bei den Auswertungen siehst du nicht mehr als alle anderen. |
| `mira@…` (Gast) | Nur das Team ERP-Umstellung Atlas. Antworten geht, Runden starten nicht. |
| `lukas@…` (Mitglied) | Gleiche Karte wie Alex, eigene Antworten als „deine Antwort“ markiert |
| `jonas@…` (Teamleitung ERP) | Go-live beschließen, danach steigt die Lesebestätigung bei den anderen |

Was dir auffällt, als Issue mit dem Kürzel der Runde, z. B. `lager-termin`, eintragen.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `scenario.ts` | Personen, Teams, Runden, Antworten, Beschlüsse. Hier ergänzt du neue Situationen. |
| `plan.ts` | Prüft das Szenario gegen die Datenbankregeln, plant die Live-Ereignisse (ohne Netz, getestet in `tests/unit/simulation.test.ts`) |
| `engine.ts` | Aufbau, Live-Modus, Aufräumen gegen Supabase |
| `*.sim.ts` | Einstieg für `pnpm sim:*` (laufen über Vitest, Konfiguration `vitest.simulation.config.mts`) |

Neue Funktion, neue Situation: Ergänze `scenario.ts` (z. B. Rückkanal-Fragen, sobald Schritt 9 steht). `pnpm test` prüft sofort, ob die Datenbank alles annehmen würde.
