# Testszenarien

Stand 17.11.2026, deckt die Schritte 1 bis 7 der Roadmap ab (bis einschließlich Beschlüsse).

Jedes Szenario sagt, was passieren soll, und wo es geprüft wird:

| Kürzel | Bedeutung | Befehl |
| --- | --- | --- |
| **U** | Unit-Test, läuft ohne Netz in der CI | `pnpm test` |
| **I** | Integrationstest gegen Staging (Datenbank, RLS, Jobs) | `pnpm test:integration` |
| **M** | Manuell im Browser, vor Demo und Abgabe | siehe [Demo-Durchlauf](#demo-durchlauf) |

Neue Funktion, neues Szenario: Zeile hier ergänzen und den Test im selben PR schreiben. Manuelle Szenarien (M) sind Kandidaten für die geplanten Playwright-Tests.

## Testdaten

Nur ausgedachte Daten, nie echte Personen oder Adressen.

| Rolle | Name | E-Mail |
| --- | --- | --- |
| Owner | Test Owner | `owner@example.test` |
| Mitglied, Teamleitung | Test Leitung | `leitung@example.test` |
| Mitglied | Test Mitglied | `mitglied@example.test` |
| Gast | Test Gast | `gast@example.test` |
| Außenstehende Person | Test Extern | `extern@example.test` |

Organisation „Testverein Nord“, Team „Vertrieb“, Runde „Testen wir die Hotline drei Monate?“.

Lehnt Supabase die Domain `example.test` bei der Registrierung ab, für den Owner eine eigene Plus-Adresse nehmen (`name+demo@…`). Diese Adresse nicht ins Repo schreiben. Personen, die der Owner anlegt, brauchen kein echtes Postfach.

Integrationstests legen eigene Wegwerf-Konten an (`cofuture.test+…`) und löschen sie wieder, siehe README unter *Mitmachen*.

## 1. Konto und Anmeldung

| ID | Szenario | Erwartung | Abgedeckt |
| --- | --- | --- | --- |
| A1 | Registrieren mit Name, E-Mail, Passwort und neuer Organisation | Konto und Organisation entstehen, die Person ist Owner, landet auf `/app` | U `auth`, `organization` · M |
| A2 | Registrieren mit Leerzeichen und Großbuchstaben in der E-Mail | E-Mail wird klein und ohne Leerzeichen gespeichert | U `auth` |
| A3 | Passwort unter 8 oder über 72 Zeichen | Meldung am Feld, kein Konto | U `auth` |
| A4 | Anmelden mit falschem Passwort | „E-Mail-Adresse oder Passwort stimmen nicht.“, ohne zu verraten, welches falsch war | U `auth` |
| A5 | `/app` ohne Anmeldung aufrufen | Weiterleitung auf `/login`; `/apple` bleibt erreichbar | U `auth` · M |
| A6 | Angemeldet `/login` aufrufen | Weiterleitung auf `/app` | U `auth` · M |
| A7 | Abmelden, danach Zurück-Taste | Kein Zugriff auf Inhalte, Weiterleitung auf `/login` | M |

## 2. Organisation und Zugangslinks

| ID | Szenario | Erwartung | Abgedeckt |
| --- | --- | --- | --- |
| O1 | Owner legt eine Person ohne Konto an | Konto entsteht als „verwaltet“, Antwort enthält einen einmaligen Zugangslink | U `routes-access` · I `organizations` |
| O2 | Owner legt eine Person an, die schon ein Konto hat | Person kommt ohne Link dazu und meldet sich wie gewohnt an; Konto gilt nicht als verwaltet | U `routes-access` |
| O3 | Dieselbe Person ein zweites Mal hinzufügen | 409 „schon in der Organisation“ | U `routes-access` |
| O4 | Mitglied oder Gast versucht, Personen hinzuzufügen | 403, kein Konto wird angelegt | U `routes-access` · I `organizations` |
| O5 | Team aus einer anderen Organisation angeben | Feldmeldung am Team, niemand wird angelegt | U `routes-access` · I `organizations` |
| O6 | Anlegen bricht nach dem Konto ab | Halb angelegtes Konto wird wieder gelöscht, Owner kann es erneut versuchen | U `routes-access` |
| O7 | Zugangslink öffnen und Passwort setzen | Passwort ist gesetzt, Link ist verbraucht, Anmeldung klappt | U `routes-access` · I `organizations` · M |
| O8 | Link ein zweites Mal öffnen, abgelaufen oder ungültig | 410 „abgelaufen oder schon benutzt“ | U `access-links`, `routes-access` · I `organizations` |
| O9 | Zwei Anfragen mit demselben Link gleichzeitig | Nur eine gewinnt, die andere bekommt 410 | U `routes-access` |
| O10 | Zu schwaches Passwort beim Link | Meldung am Feld, der Link bleibt gültig | U `routes-access` |
| O11 | Neuer Link für dieselbe Person | Alter, unbenutzter Link wird ungültig | U `access-links` · I `organizations` |
| O12 | Was steht in der Datenbank? | Nur der SHA-256-Hash des Tokens, nie das Token | U `organization`, `access-links` · I `organizations` |
| O13 | Passwort zurücksetzen oder Konto löschen | Nur bei Konten, die die Organisation selbst angelegt hat und die in keiner anderen sind | U `access-links` |
| O14 | Mehrere Organisationen, Wechsel in der Seitenleiste | Inhalte wechseln, Mitgliedschaft wird bei jedem Aufruf geprüft | M |

## 3. Rollen

| ID | Szenario | Erwartung | Abgedeckt |
| --- | --- | --- | --- |
| R1 | Rollen Owner, Mitglied, Gast | Andere Rollen (z. B. „admin“) werden abgelehnt; jede Rolle hat deutsche Bezeichnung und Hinweis | U `organization`, `client-helpers` |
| R2 | Gast legt ein Team an | 403 „Als Gast kannst du keine Teams anlegen.“ | U `routes-access` · I `organizations` |
| R3 | Gast startet eine Runde | Abgelehnt; antworten darf er | I `organizations` |
| R4 | Letzter Owner gibt die Rolle ab | Nicht möglich, eine Person bleibt Owner | I `organizations` |
| R5 | Organisation übergeben | Rollen werden getauscht | I `organizations` |
| R6 | Owner entfernt die einzige Teamleitung | Team geht an den Owner, die Person verliert den Zugriff | I `organizations` |
| R7 | Organisation oder Team mit Inhalten löschen | Nicht möglich, nur wenn leer | I `organizations` |

## 4. Teams

| ID | Szenario | Erwartung | Abgedeckt |
| --- | --- | --- | --- |
| T1 | Team in der gewählten Organisation anlegen | Team entsteht dort, die Person wird Teamleitung | U `routes-access` · I `rls` |
| T2 | Teamname leer oder über 80 Zeichen | Meldung am Feld | U `api`, `client-helpers` |
| T3 | Person hinzufügen per Auswahl (Organisation) oder E-Mail (ohne) | Beides wird angenommen, E-Mail ohne Groß- und Leerzeichen | U `client-helpers` · I `teams` |
| T4 | Unbekannte E-Mail | Meldung, niemand wird hinzugefügt | I `teams` |
| T5 | Mitglieder sehen einander | Namen ja, E-Mail-Adressen nie | I `teams`, `organizations` |
| T6 | Letzte Teamleitung verlässt das Team | Nicht möglich | I `teams` |
| T7 | Teams in der Seitenleiste | Punkte in den Kategoriefarben in fester Reihenfolge, danach von vorn | U `client-helpers` · M |

## 5. Runden

| ID | Szenario | Erwartung | Abgedeckt |
| --- | --- | --- | --- |
| N1 | Runde mit Frage, optionalem Kontext und Frist starten | Runde ist offen, leerer Kontext wird weggelassen | U `round` · I `rounds` |
| N2 | Frist in der Vergangenheit, fehlend oder über 60 Tage | Meldung am Feld | U `round` |
| N3 | Außenstehende Person startet eine Runde im Team | Abgelehnt | I `rounds` |
| N4 | Frage ändern nach der ersten Antwort | Abgelehnt, die Frage ist eingefroren | I `rounds` |
| N5 | Frist verschieben | Nur in die Zukunft | I `rounds` |
| N6 | Runde vorzeitig schließen | Ersteller oder Teamleitung: ja; andere: 403; schon geschlossen: 409; Wiedereröffnen: 400 | U `routes-rounds` · I `rounds` |
| N7 | Frist läuft ab | `pg_cron` schließt die Runde, danach sind alle Antworten sichtbar | I `rounds` |
| N8 | Countdown | „noch 2 Tage 3 Std.“ … „noch unter 1 Min.“, danach geschlossen | U `round` · M |
| N9 | Zwei Personen haben die Runde offen, eine antwortet | Anzahl der Antworten aktualisiert sich live, ohne Namen | I `rounds` · M |

## 6. Antworten per Text

| ID | Szenario | Erwartung | Abgedeckt |
| --- | --- | --- | --- |
| X1 | Erste Antwort abgeben | 201 mit Pseudonym (A01, A02 …); die Route schickt keine Nutzer-ID mit | U `routes-rounds` · I `rls` |
| X2 | Antwort ändern, solange die Runde offen ist | Dieselbe Antwort wird aktualisiert, keine zweite | U `routes-rounds` |
| X3 | Leere Antwort oder nur Leerzeichen | Meldung „Schreib eine Antwort.“ | U `round`, `routes-rounds` |
| X4 | Antworten nach dem Schließen oder nach Fristablauf | 409 „Die Runde ist geschlossen.“ | U `routes-rounds` · I `rls` |
| X5 | Runde offen | Jede Person sieht nur ihre eigene Antwort | I `rls` |
| X6 | Runde geschlossen | Alle sehen alle Antworten, nur mit Pseudonym | I `rls`, `rounds` |
| X7 | Ungültige Runden-ID in der URL | 404, ohne Datenbankzugriff | U `routes-rounds` |

## 7. Antworten per Sprache

| ID | Szenario | Erwartung | Abgedeckt |
| --- | --- | --- | --- |
| V1 | Aufnahme im Browser, Upload in den eigenen Ordner | Job wird angelegt, Transkription startet direkt nach der Antwort | U `routes-rounds` · I `voice` · M |
| V2 | Pfad im Ordner einer anderen Person | 403, kein Job | U `routes-rounds`, `stt` · I `voice` |
| V3 | Falsches Format, Pfadtricks, über 2 Minuten | Abgelehnt | U `stt` |
| V4 | Transkription klappt | Text steht im Job, Audio wird sofort gelöscht | U `jobs` · I `voice` |
| V5 | Groq ausgelastet (429, 5xx) oder Netzfehler | Gemini übernimmt | U `stt`, `providers` |
| V6 | Dienst ausgelastet, Versuch 1 oder 2 | „Versuch es gleich noch einmal.“, Audio bleibt für den neuen Versuch | U `jobs` |
| V7 | Letzter Versuch scheitert oder Fehler würde sich wiederholen | „Nimm sie bitte neu auf oder antworte als Text.“, Audio wird gelöscht | U `jobs` |
| V8 | Stille Aufnahme | „keine Sprache erkannt“, Audio wird gelöscht | U `jobs` |
| V9 | Aufnahme fehlt im Speicher | Klare Meldung | U `jobs` · I `voice` |
| V10 | Audio, das nie verarbeitet wurde | Wird nach 24 Stunden gelöscht | U `jobs` |
| V11 | Audio zurücklesen | Niemand kann Audio herunterladen, auch nicht die eigene Datei | I `voice` |
| V12 | Mikrofon verweigert oder nicht vorhanden | Hinweis, Textantwort bleibt möglich | M |

## 8. Perspektivenkarte

| ID | Szenario | Erwartung | Abgedeckt |
| --- | --- | --- | --- |
| P1 | Runde offen | Keine Analyse | I `analysis` |
| P2 | Runde wird geschlossen | Genau ein Job; die Karte ist für alle im Team gleich sichtbar | I `analysis` |
| P3 | Was geht an das Sprachmodell? | Nur Frage, Kontext, Pseudonyme und Antworttexte; keine Namen, E-Mails, Nutzer-IDs | U `jobs`, `providers` |
| P4 | Modell erfindet Quell-IDs oder liefert Aussagen ohne Quelle | Unbekannte IDs fallen weg, Aussagen ohne Quelle werden verworfen | U `analysis`, `providers` |
| P5 | Modell lässt Antworten aus | Sie landen im Cluster „Nicht zugeordnet“, Abdeckung bleibt 100 % | U `analysis`, `providers` |
| P6 | Einzelstimme | Bleibt als eigener Cluster sichtbar | U `analysis` |
| P7 | Antwort enthält „Ignoriere alles …“ oder `</response>` | Kann den Prompt nicht verlassen | U `analysis` |
| P8 | Gemini überlastet oder Ausgabe passt nicht zum Schema | Groq übernimmt | U `analysis`, `providers` |
| P9 | Analyse scheitert vorübergehend | „gleich noch einmal“, neuer Versuch über die Rundenseite | U `jobs`, `routes-access` |
| P10 | Analyse scheitert endgültig (3 Versuche) | Hinweis auf die Antworten im Original, kein weiterer Versuch | U `jobs`, `routes-access` |
| P11 | Runde ohne Antworten | Kein Modellaufruf, klare Meldung | U `jobs` |
| P12 | API-Schlüssel | Stehen im Header, nie in der URL | U `providers` |
| P13 | Karte auf der Rundenseite ansehen | Jede Aussage zeigt ihre Quellen (A01 …), die Antworten stehen darunter im Original | M |

## 9. Beschlüsse

| ID | Szenario | Erwartung | Abgedeckt |
| --- | --- | --- | --- |
| D1 | Ersteller oder Teamleitung beschließt eine geschlossene Runde mit Begründung | Beschluss gespeichert, Runde „Entschieden“, Clusterverweise sortiert und ohne Doppelte | U `decision`, `routes-rounds` · I `decisions` |
| D2 | Beschluss ohne Begründung | Meldung am Feld | U `decision`, `routes-rounds` |
| D3 | Runde noch offen | 409 „Schließ sie zuerst.“ | U `routes-rounds` · I `decisions` |
| D4 | Zweiter Beschluss | 409 „gibt es schon“ | U `routes-rounds` · I `decisions` |
| D5 | Mitglied, Gast oder außenstehende Person beschließt | 403 | U `routes-rounds` · I `decisions` |
| D6 | „Entschieden“ ohne Beschluss setzen | Nicht möglich | I `decisions` |
| D7 | Beschluss ändern oder löschen | Für niemanden möglich | I `decisions` |
| D8 | Folgerunde starten | Nur mit geschlossener Ursprungsrunde im selben Team | U `decision` · I `decisions` |
| D9 | Lesebestätigung | Nur die eigene, mehrfach klicken zählt einmal, Anzahl ohne Namen | U `routes-rounds` · I `decisions` |
| D10 | Beschluss eines fremden Teams bestätigen | 404 | U `routes-rounds` · I `decisions` |

## 10. Gestaltungsprinzipien

Querschnitt: Diese Szenarien prüfen die nicht verhandelbaren Regeln aus der README.

| Prinzip | Prüfung | Abgedeckt |
| --- | --- | --- |
| Gleiche Sicht für alle | Karte und Beschluss sehen alle im Team gleich, keine Ansicht nur für Leitung oder Owner | I `analysis`, `decisions` · M |
| Inhalte statt Personen | Antwortzahl und Lesebestätigungen ohne Namen | I `rounds`, `decisions` |
| Pseudonym als Standard | Antworten erscheinen als A01, A02 …, ohne Autor-ID | I `rls` · U `routes-rounds` |
| Minderheiten sichtbar | `single_voice` bleibt eigener Cluster, nichts geht verloren | U `analysis` |
| Belegbar | Jede Aussage hat mindestens eine gültige Quell-ID | U `analysis`, `providers` |
| Mensch entscheidet | Beschluss nur durch Menschen mit Begründung, AsyncMeet wird nur verwiesen | U `routes-rounds` · I `decisions` |
| Datensparsam | Nur Pseudonyme und Texte an die KI; Audio weg nach Transkription, spätestens nach 24 h; nur Token-Hash gespeichert | U `jobs`, `access-links` · I `voice`, `organizations` |

## 11. Betrieb und Robustheit

| ID | Szenario | Erwartung | Abgedeckt |
| --- | --- | --- | --- |
| B1 | `/api/worker` ohne, mit falschem oder zu kurzem Secret | 401, es läuft nichts | U `routes-access` |
| B2 | `/api/worker` mit Secret | Transkription, Analyse und Audio-Aufräumen laufen | U `routes-access` |
| B3 | Kaputtes JSON an eine API | 400 `invalid_json` im einheitlichen Fehlerformat | U `api` |
| B4 | Netz weg im Browser | `apiFetch` wirft nicht, zeigt „Keine Verbindung …“ | U `client-helpers` |
| B5 | Unerwartete Fehlerseite (z. B. 502) | Allgemeine Meldung statt Absturz | U `client-helpers` |
| B6 | Fehlende Umgebungsvariablen | Klare Fehlermeldung mit Variablennamen | U `env` |
| B7 | Formular absenden, weiterleiten, zurückkommen | Button ist wieder aktiv | M |

## 12. Oberfläche und Barrierefreiheit

Nur manuell, Kandidaten für Playwright.

| ID | Szenario | Erwartung |
| --- | --- | --- |
| UI1 | Alle Abläufe nur mit Tastatur | Fokus sichtbar, Reihenfolge logisch, Dialoge mit Escape schließbar |
| UI2 | Breite 375 px | Kein horizontales Scrollen, Touch-Ziele mindestens 44 px |
| UI3 | Status (offen, geschlossen, entschieden, Fehler) | Immer mit Wort oder Icon, nie nur Farbe |
| UI4 | `prefers-reduced-motion` | Keine Animationen |
| UI5 | Texte | Du-Ansprache, keine Ausrufezeichen, Buttons als Verb + Objekt, Datum `17.11.2026, 12:00 Uhr` |

## Demo-Durchlauf

Schneller geht es mit der [Büro-Simulation](../simulation/README.md): `pnpm sim:setup` baut eine ganze Firma auf, ihre Aufgaben zum Durchspielen decken die meisten Schritte unten ab.

Vor jeder Demo und vor der Abgabe einmal komplett im Browser, zwei Fenster (eines privat). Dauer etwa 15 Minuten.

1. **Registrieren** als Test Owner mit Organisation „Testverein Nord“. Erwartung: Dashboard, Owner-Badge. (A1)
2. **Personen anlegen:** Test Leitung (Mitglied), Test Gast (Gast). Erwartung: je ein Zugangslink. (O1)
3. **Zugangslink** von Test Leitung im privaten Fenster öffnen, Passwort setzen. Erwartung: angemeldet. Link erneut öffnen: „abgelaufen oder schon benutzt“. (O7, O8)
4. **Team „Vertrieb“** als Test Owner anlegen, Test Leitung und Test Gast hinzufügen. (T1, T3)
5. **Runde starten** mit Frist in 10 Minuten. Erwartung: Countdown läuft. (N1, N8)
6. **Antworten:** Test Owner per Text, Test Leitung per Sprache. Erwartung: Pseudonyme A01, A02; Anzahl aktualisiert sich im anderen Fenster live; nur die eigene Antwort ist sichtbar. (X1, V1, N9, X5)
7. **Antwort ändern** als Test Owner. Erwartung: keine zweite Antwort. (X2)
8. **Runde schließen** als Test Owner. Erwartung: alle Antworten sichtbar, Perspektivenkarte erscheint mit Quellen. (N6, P2, P13)
9. **Als Test Gast** prüfen: dieselbe Karte, keine E-Mail-Adressen, keine eigene Runde startbar. (R3, Gleiche Sicht)
10. **Beschluss** als Test Owner mit Begründung und Verweis auf einen Cluster. Erwartung: Runde „Entschieden“. (D1)
11. **Lesebestätigung** als Test Leitung. Erwartung: Zähler steigt um eins, ohne Namen. (D9)
12. **Folgerunde** aus dem Beschluss starten. Erwartung: Verweis auf die Ursprungsrunde. (D8)
13. **Aufräumen:** Testpersonen löschen, Team und Organisation löschen. (O13, R7)
