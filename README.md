# CoFuture

**Entscheidungen, die alle verstehen.** Zusammenarbeit neu denken. Mit KI.

[![CI](https://github.com/Co-Future/CoFuture/actions/workflows/ci.yml/badge.svg)](https://github.com/Co-Future/CoFuture/actions/workflows/ci.yml) ![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-1D4E89) ![Next.js 16](https://img.shields.io/badge/Next.js-16-1D4E89) ![Supabase](https://img.shields.io/badge/Supabase-Frankfurt-1D4E89)

CoFuture ist eine Plattform für Kommunikation und Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden. Die KI fasst zusammen, sortiert und belegt. Entscheiden tun die Menschen.

> **Leitfrage:** Wie kann KI die Kommunikation und den Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden automatisieren, ohne dass Menschen die Entscheidung abgeben?

> **Diese README ist der Einstieg** für Ziel, Scope und Stand. Alles Technische steht in [`docs/`](docs/README.md), jede Information an genau einem Ort. Wer etwas fertigstellt oder den Plan ändert, passt README, Doku und [`CHANGELOG.md`](CHANGELOG.md) im selben PR an.

**Inhalt:** [Überblick](#überblick) · [Stand](#stand) · [Dokumentation](#dokumentation) · [Mitmachen](#mitmachen)

**Version:** siehe [`CHANGELOG.md`](CHANGELOG.md) und [Releases](https://github.com/Co-Future/CoFuture/tags) · [Semantic Versioning](docs/versioning.md)

---

## Überblick

### Problem

- Meetings kosten viel Zeit, sind schwer zu koordinieren, und oft reden nur wenige.
- Protokolle, Beschlüsse und Aufgaben gehen verloren.
- Kundenanfragen und E-Mails sind verstreut, es fehlt eine gemeinsame Historie.
- Wissen steckt in Köpfen, Postfächern und Chats statt an einem durchsuchbaren Ort.
- Stille Perspektiven gehen unter, Entscheidungen sind schwer nachvollziehbar.

### Kernfeature: AsyncMeet

Asynchroner **Austausch** statt Live-Meetings ([ADR 012](docs/adr/012-austausch-mehrere-fragen.md)):

1. Die Leitung spricht ihre Fragen in einem Rutsch ein. AsyncMeet zieht die einzelnen Fragen heraus und erkennt, an wen eine Frage nur gehen soll. Fragen lassen sich ändern, per Sprache ergänzen oder als Text hinzufügen. Eine Frist ist optional.
2. Alle Gefragten antworten per **Sprache oder Text**, wann und wo es passt. AsyncMeet ordnet eine eingesprochene Antwort den Fragen zu, jede Antwort steht als Karte unter ihrer Frage und lässt sich prüfen und ergänzen.
3. Sprachaufnahmen werden transkribiert, das Audio wird danach gelöscht.
4. Rückfragen an die Leitung stehen im Austausch selbst. Sie sehen nur die fragende Person und die Leitung. Eine Frage nur für bestimmte Personen sehen nur diese und die Leitung.
5. AsyncMeet erstellt **je Frage eine Perspektivenkarte**: Themen, Konsens, Dissens, Einzelstimmen, jede Aussage mit Quelle.
6. Folge-Austausche führen zum Beschluss, der mit Begründung an alle geht.

### Gestaltungsprinzipien

| Prinzip | Bedeutung |
| --- | --- |
| Gleiche Sicht für alle | Keine Auswertungen, die nur Führungskräfte sehen. Rollen ändern, was man tun darf, nie was man sieht. Ausnahme: Fragen nur für bestimmte Personen und Rückfragen sehen nur die Beteiligten ([ADR 012](docs/adr/012-austausch-mehrere-fragen.md)). |
| Inhalte statt Personen bewerten | Die KI prüft Fristen, Vollständigkeit und offene Aufgaben, nie die Leistung einzelner. |
| Pseudonym als Standard | Jede Person wählt ihren Anzeigenamen selbst, Klarnamen nur mit Zustimmung. Im Austausch erscheint dieser Name statt A01 (ADR 012), an die KI gehen nur Pseudonyme. |
| Minderheiten sichtbar | Einzelstimmen werden markiert, nicht herausgemittelt. |
| Belegbar | Jede KI-Aussage verweist auf mindestens eine Originalquelle, sonst wird sie verworfen. |
| Mensch entscheidet | Die KI bereitet vor, Menschen beschließen. |
| Datensparsam | An die KI gehen nur Pseudonyme und Texte. Alle Daten liegen in der EU. |

### Scope

| | Inhalt |
| --- | --- |
| **MVP** | Login, Organisationen und Teams, Dialogrunden, Antworten per Sprache und Text, Perspektivenkarte mit Quellen, Beschlüsse, Wissensspeicher, Rückkanal |
| **Danach** (MoSCoW) | Statusrunden, Besprechungen, E-Mail-Zusammenfassung, Kundenkontakt, Webseiten-Anfragen, Stimmungsbild |
| **Mandanten** | Organisationen bündeln Personen und Teams. Eine Person kann in mehreren sein, mit der Rolle Owner, Mitglied oder Gast ([ADR 011](docs/adr/011-zugang-organisationen-einladungen.md)). |
| **Nicht geplant** | Native Apps, Slack- oder Teams-Integration, SSO, Zahlungen |
| **Erfolgskriterien** | End-to-End-Demo läuft, Analyse von 30 Antworten unter 60 s, 100 % der Antworten in der Karte abgedeckt, DSGVO-konform |
| **Rahmen** | KI-Kosten unter 50 € gesamt, kostenlose Hosting-Tarife, Abgabe 05.02.2027 |

---

## Stand

Stand 18.11.2026, Version 0.11.0. AsyncMeet läuft von Anfang bis Ende: Organisation anlegen, neue Personen per Zugangslink, bestehende Konten per Einladung mit Bestätigung aufnehmen, Team anlegen, Runde starten, per Text oder Sprache antworten, Runde schließt, AsyncMeet erstellt die Perspektivenkarte mit Quellen, das Team hält den Beschluss mit Begründung fest.

| Schritt | Inhalt | Status |
| --- | --- | --- |
| 1 | Supabase-Fundament: Schema, Row Level Security, Pseudonyme, Tests | fertig |
| 2 | KI-Proof-of-Concept Groq vs. Gemini ([Bericht](eval/poc/REPORT.md)) | fertig |
| 3 | Registrieren, Anmelden, geschützter Bereich, Teams und Mitglieder | fertig |
| 3b | Organisationen, Personen anlegen, einmalige Zugangslinks ([ADR 011](docs/adr/011-zugang-organisationen-einladungen.md)) | fertig |
| 3c | App-Navigation: Seitenleiste mit Organisations-Menü, persönliches Dashboard, Team-Dashboards | fertig |
| 3d | Rollen Owner, Mitglied, Gast; Organisation und Team übergeben oder löschen (wenn leer); Konten der Organisation löschen, Passwort zurücksetzen | fertig |
| 3e | Einladungen mit Bestätigung: Wer schon ein Konto hat, nimmt die Einladung an oder lehnt ab; Owner ziehen offene Einladungen zurück. Zugangslinks nur noch für Konten der Organisation | fertig |
| 4 | Runden mit Frist, Textantworten, automatisches Schließen, Live-Updates | fertig |
| 5 | Sprachantworten: Aufnahme im Browser (bis 10 Min.), Transkription im Hintergrund, Audio wird gelöscht. Auch die Frage einer Runde lässt sich einsprechen, AsyncMeet schlägt Frage und Kontext vor | fertig |
| 6 | Perspektivenkarte: Analyse im Hintergrund, Quellenprüfung, Anzeige auf der Rundenseite | fertig |
| 7 | Beschlüsse: Beschluss mit Begründung, Folgerunden, Lesebestätigung, Oberfläche | fertig |
| 7c | Austausch mit mehreren Fragen: einsprechen und abgleichen, mehrere Zielpersonen je Frage, Prüfschritt mit eigenen Fragen, Antworten je Frage zusammengefasst, Rückfragen, Zusammenfassung je Frage und Antworten je Person, Frist optional, Gewichtung je Punkt, Beschlüsse mit Vorschlag von AsyncMeet und Diktat ([ADR 012](docs/adr/012-austausch-mehrere-fragen.md)) | fertig |
| 8 | Wissensspeicher: Speicher mit Rechten wie im Original, Suche nach Stichwort und Bedeutung über die Organisation, Frage mit Belegen (Seite „Wissen“) ([Roadmap](docs/roadmap.md#8-wissensspeicher-mvp), [ADR 013](docs/adr/013-wissensspeicher.md)) | fertig |
| 9 | Rückkanal ([Roadmap](docs/roadmap.md#9-rückkanal-mvp)) | offen |

### Offene Aufgaben im Betrieb

- [ ] Prod-Datenbank `cofuture-prod` einrichten. Dort sind noch keine Migrationen, die App läuft gegen Staging.
- [ ] Vercel-Schutz für Preview-Links ausschalten, damit alle sie ohne Vercel-Login öffnen können.
- [x] Integrationstests für die Organisations-Funktionen (`tests/integration/organizations.test.ts`, `tests/integration/invitations.test.ts`).
- [ ] `pg_cron` ruft `/api/worker` als Sicherheitsnetz auf, sobald die Produktions-URL fest steht. Bis dahin startet die Analyse, sobald jemand die Rundenseite öffnet.
- [ ] `GEMINI_API_KEY` und `LLM_PROVIDER` in Vercel prüfen. Bis 17.11.2026 liefen alle Perspektivenkarten über die Reserve Groq. Warum Gemini ausfällt, steht jetzt im Analyse-Job unter `result.failures`.
- [ ] Playwright-E2E-Tests im Repo.
- [ ] Zuständigkeiten im Team festlegen und hier eintragen (wer verantwortet welchen Bereich).

---

## Dokumentation

| Thema | Link |
| --- | --- |
| Übersicht: wo steht was, was muss ich anpassen | [docs/README.md](docs/README.md) |
| **Tech-Stack** mit Änderungsprotokoll | [docs/tech-stack.md](docs/tech-stack.md) |
| **Architektur** mit Schaubildern (System, Ablauf, Jobs, Datenmodell) | [docs/architecture.md](docs/architecture.md) |
| **Geplante Funktionen** und was sie können sollen | [docs/roadmap.md](docs/roadmap.md) |
| API-Endpunkte | [docs/api.md](docs/api.md) |
| Architekturentscheidungen (ADR) | [docs/adr/](docs/adr/README.md) |
| Neu im Team, lokal einrichten | [docs/setup.md](docs/setup.md) |
| Betrieb: Datenbank, Testkonten, KI-Pipeline | [docs/operations.md](docs/operations.md) |
| Versionen und Releases | [docs/versioning.md](docs/versioning.md), [CHANGELOG.md](CHANGELOG.md) |
| Regeln für alle, auch Claude Code | [CLAUDE.md](CLAUDE.md) |

---

## Mitmachen

1. Branch von `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`, bei Roadmap-Schritten mit Nummer (`feat/7-beschluesse`)
2. Kleine Commits nach [Conventional Commits](https://www.conventionalcommits.org/de/)
3. Pull Request mit Vorlage. Freigabe durch Constantin oder Luca, CI muss grün sein.
4. Squash-Merge, Branch wird gelöscht. README, Doku und `CHANGELOG.md` im selben PR aktualisieren ([was muss ich anpassen?](docs/README.md#was-muss-ich-anpassen)).
5. Versionen und Releases nach [`docs/versioning.md`](docs/versioning.md).

Alle Regeln, auch für Claude Code: [`CLAUDE.md`](CLAUDE.md). Designsprache: [`CLAUDE.md#designsprache`](CLAUDE.md#designsprache), Tokens in [`app/globals.css`](app/globals.css).

Entstanden im Seminar „Zurück in die Digitale Zukunft“, Kategorie Arbeit.

## Lizenz

[MIT](LICENSE) © 2026 CoFuture-Team


## offene Features

**Statusmeeting wird zur asynchronen Statusrunde**

- Statt 45 Minuten Jour fixe beantworten alle drei feste Fragen per Sprache oder Text. AsyncMeet fasst Blocker und Fristen mit Quellen zusammen.
- Kommunikation frisst 57 % des Arbeitstags (Microsoft). Teams mit gezielt meetingfreien Tagen berichten deutlich mehr Produktivität (MIT SMR, 2022).

**2. Entscheidungen, bei denen die stillen Stimmen zählen**

- Bei Veränderungen wie Homeoffice-Regeln oder Schichtmodell antworten alle unter Pseudonym. Einzelstimmen werden markiert, der Beschluss geht mit Begründung an alle.
- Etwa die Hälfte der Beschäftigten sagt im Job nicht offen ihre Meinung (SHRM), und nur 21 % vertrauen ihrer Führungskraft voll (Gallup 2024).

**3. Gedächtnis für Beschlüsse: „Warum haben wir das so entschieden?“**

- Der Wissensspeicher beantwortet Fragen mit früheren Beschlüssen, Begründungen und Links zu den Quellen. Das hilft beim Onboarding und verhindert, dass dieselbe Frage zweimal diskutiert wird.
- Teams verbringen rund 25 % ihrer Zeit mit der Suche nach Antworten, und 72 % müssen dafür jemanden fragen oder ein Meeting ansetzen (Atlassian 2025).

- Kontext Erweiterung Ki Pipeline
    
    Die Analyse-Pipeline von CoFuture arbeitet heute in drei Schritten. Zuerst zerlegt die KI jede Antwort in einzelne Aussagen (**extract**). Danach fasst sie diese Aussagen zu Themen zusammen (**cluster**). Zum Schluss bewertet sie jedes Thema als Konsens, Dissens oder Einzelstimme (**assess**). Am Ende prüft der Code die Ergebnisse. So entsteht eine gut belegte Perspektivenkarte. Die Pipeline erkennt aber nur Meinungen, Ideen, Risiken und Fragen. Prozesse, Use Cases oder Anforderungen findet sie nicht, weil sie danach gar nicht sucht.
    
    ### Ziel
    
    Die Pipeline soll aus den Antworten auch Abläufe, Anwendungsfälle und Probleme herauslesen und deuten. Die Ergebnisse sollen dabei so nachvollziehbar und belegbar bleiben wie bisher. plus eine textuelle Zusammenfassung
    
    ### Maßnahmen
    
    **1. Das Extract-Schema erweitern.**
    
    Diese Maßnahme bringt am meisten. Neue Aussagetypen wie *Prozess*, *Use Case*, *Problem* und *Anforderung* bekommen eigene Felder. Ein Prozess hat zum Beispiel Auslöser, Schritte, Beteiligte und Schmerzpunkt. Ein Use Case hat Akteur, Ziel und Nutzen. Zu jeder Aussage wird außerdem festgehalten, ob sie wörtlich in der Antwort steht oder von der KI abgeleitet ist. Die KI darf also deuten, aber diese Deutung bleibt immer erkennbar.
    
    **2. Der KI mehr Kontext geben.**
    
    Die KI bekommt die Fragestellung der Runde, ein Glossar mit Begriffen aus dem Team und einige korrekt annotierte Beispielantworten. Je nach Rundentyp kommt ein eigener Prompt zum Einsatz, etwa für eine Prozessaufnahme oder eine Ideensammlung. Ein einzelner Prompt muss dann nicht mehr alles abdecken.
    
    **3. Einen Synthese-Schritt einführen.**
    
    Ein neuer Schritt fasst Aussagen aus mehreren Antworten zusammen. Daraus entstehen vollständige Prozessabläufe mit Varianten und Schmerzpunkten sowie zusammengeführte User Stories. Die User Stories werden danach priorisiert, wie oft sie genannt werden und wie groß das Problem ist. Beim Clustern schlägt die KI zuerst Themen vor und ordnet ihnen erst danach die Aussagen zu. Dadurch wird das Ergebnis stabiler.
    
    **4. Die Qualität absichern.**
    
    Bei den anspruchsvollen Schritten bekommt die KI Raum zum Nachdenken, bevor sie ihr Ergebnis liefert. Ein zusätzlicher Prüfschritt vergleicht das Ergebnis mit den Originalantworten. Der Code kontrolliert außerdem, ob jedes Zitat wörtlich in der Quelle vorkommt und ob jeder Prozess vollständig ist. Je nach Schritt kann ein anderes Modell zum Einsatz kommen: ein günstiges zum Extrahieren, ein stärkeres zum Clustern und Bewerten.
    
    **5. Die Wirkung messen.**
    
    Das Golden Dataset bekommt Annotationen dazu, welche Prozesse und Use Cases tatsächlich in den Testantworten stecken. Damit lässt sich Prompt v1 mit Prompt v2 vergleichen: wie viel die Pipeline findet, wie genau sie ist, ob die Belege stimmen und wie stabil die Ergebnisse sind. Das passt direkt zum offenen Ticket „Qualitätsevaluation & Prompt-Tuning“.
    
    ### Wichtige Leitplanke
    
    Je freier die KI deutet, desto stärker beeinflussen die Antworttexte selbst das Ergebnis. Antworten müssen deshalb weiterhin klar als Daten abgegrenzt bleiben und dürfen nie als Anweisung gelten. Sonst könnte jemand die Analyse über seine eigene Antwort manipulieren.
    
- Schnittstelle zu Enterprise Systemen
    
    Unsere Projektteams arbeiten heute in verschiedenen Tools. An der Uni läuft vieles über Teams, Partnerorganisationen nutzen oft Slack, und dazu kommen Moodle und E-Mail. Absprachen, Entscheidungen und Aufgaben verteilen sich dadurch auf viele einzelne Chats. Wer etwas sucht, muss sich durch lange Threads lesen. Den wöchentlichen Status-Bericht schreibt jemand von Hand zusammen. Unsere Plattform weiß von diesen Gesprächen bisher nichts, weil es keine Verbindung zu den Tools gibt.
    
    **Ziel**
    
    Die Plattform soll Informationen aus Teams, Slack und weiteren Tools automatisch aufnehmen und ordnen. Die KI dient dabei als Datenschnittstelle. Niemand muss das Tool wechseln oder Inhalte doppelt pflegen. Die Ergebnisse sollen trotzdem nachvollziehbar und belegbar bleiben.
    
    **Maßnahmen**
    
    **1. Die Tools über Schnittstellen anbinden.**
    
    Slack wird über seine Events-API angebunden, Teams über die Microsoft Graph API oder einen Bot. Die Plattform liest nur Kanäle, die ein Team ausdrücklich freigibt. Für die erste Demo eignet sich Slack besser, weil Teams an der Uni meist zusätzliche Freigaben braucht. Mit Low-Code-Tools wie n8n oder Make lässt sich diese Verbindung ohne viel Programmierung bauen.
    
    **2. Die KI Nachrichten strukturieren lassen.**
    
    Diese Maßnahme bringt am meisten. Die KI liest die Nachrichten und erkennt darin bestimmte Aussagetypen: Entscheidung, Aufgabe, Frage und Problem. Jeder Typ hat eigene Felder. Eine Aufgabe hat zum Beispiel eine verantwortliche Person, einen Inhalt und einen Termin. Jede Aussage verweist auf die Originalnachricht. Außerdem wird festgehalten, ob sie wörtlich so im Chat steht oder von der KI abgeleitet ist. Die KI darf also deuten, aber ihre Deutung bleibt immer erkennbar.
    
    **3. Wissen über RAG zugänglich machen.**
    
    Wenn jemand im Chat eine Frage stellt, antwortet ein Bot mit Inhalten aus der Wissensbasis der Plattform, zum Beispiel aus den Wissens-Nuggets. Jede Antwort enthält eine Quellenangabe. Der Bot antwortet nur aus geprüften Inhalten und nicht aus seinem allgemeinen Wissen. So sinkt das Risiko von Halluzinationen.
    
    **4. Status-Berichte und Aufgaben automatisch vorbereiten.**
    
    Einmal pro Woche erstellt die KI einen Entwurf des Status-Berichts aus den Gesprächen der Woche. Erkannte Aufgaben erscheinen als Vorschläge auf der Plattform. Ein Mensch prüft und bestätigt sie, bevor sie gelten. Auch Nachrichten, die die KI selbst in einen Kanal schreibt, gehen erst nach einer Freigabe raus.
    
    **5. Datenschutz und Transparenz absichern.**
    
    Jedes Team willigt pro Kanal ein. Im Kanal ist sichtbar, dass die KI mitliest. Die KI sieht nur, was die jeweilige Person auch selbst sehen darf. Die Daten werden in der EU verarbeitet und nach einer festen Frist gelöscht. Damit erfüllt die Plattform auch die Transparenzpflichten aus dem EU AI Act.
    
    **Wichtige Leitplanken**
    
    Chatnachrichten sind für die KI immer Daten und nie Anweisungen. Sonst könnte jemand mit einer geschickt formulierten Nachricht den Bot steuern oder den Status-Bericht verfälschen.
    
    Die Plattform soll Zusammenarbeit erleichtern und keine Leistung kontrollieren. Sie wertet deshalb Teams und Themen aus, aber keine einzelnen Personen. Sonst wird aus einem Hilfsmittel schnell ein Überwachungswerkzeug.
    
    **Fazit**
    
    Die größte Wirkung entsteht, wenn die KI Nachrichten in klar strukturierte Aussagen übersetzt. Die Anbindung über Schnittstellen sorgt dafür, dass niemand sein gewohntes Tool verlassen muss. Freigaben durch Menschen, Quellenangaben und klare Datenschutzregeln sorgen dafür, dass die Plattform hilfreich wird, ohne an Vertrauen zu verlieren.
    
    —> Technische Machbarkeit analysieren 
    
- Sprachunterstützung
    
    ToDo: Datenstruktur um Muttersprache erweitern KI Pipeline Fähigkeit verleihen verschiedene Sprachen zu verstehen und zu übersetzen
    
    CoFuture hat die Fähigkeit verschiedene Sprachen zu paraphrasieren und jeder Mitarbeiter kann seine bevorzugte Sprache auswählen in der er die Infos erhalten möchte
    
    UserInterface wird benötigt um Stammdaten zu pflegen
    
- Benachrichtigung
    
    User werden über Kanäle benrachtigt, wie der Stand zu Runden Fristen etc.. Zielbild wäre sowohl nativ in der App über z.B. einen Websocket und per Mail
    
- 
    
    **Use Case – KI-gestützte Priorisierung im Projektteam**
    
    **Projekt:** CoFuture
    
    **Kernfunktion:** AsyncMeet
    
    **Anwendungsbereich:** Unternehmenskommunikation und Projektmanagement
    
    **1. Ausgangssituation**
    
    Ein Unternehmen entwickelt eine neue Software. Kurz vor der Veröffentlichung muss entschieden werden, welche Funktionen priorisiert werden und welche auf einen späteren Zeitpunkt verschoben werden können.
    
    Das Projektteam besteht aus acht Personen, die teilweise im Homeoffice und zu unterschiedlichen Zeiten arbeiten.
    
    Normalerweise wird dafür ein gemeinsames Meeting organisiert. Dabei entstehen mehrere Probleme:
    
    Die Terminfindung ist aufwendig.
    
    Einzelne Personen dominieren die Diskussion.
    
    Nicht alle Perspektiven werden ausreichend berücksichtigt.
    
    Entscheidungen und ihre Begründungen werden nicht immer nachvollziehbar dokumentiert.
    
    **2. Lösung durch CoFuture**
    
    Statt eines klassischen Meetings wird eine asynchrone Abstimmungsrunde gestartet.
    
    **Schritt 1 – Austausch eröffnen**
    
    Die Projektleitung stellt eine Frage:
    
    „Welche drei Funktionen sollten wir vor dem nächsten Release priorisieren und warum?“
    
    **Schritt 2 – Perspektiven sammeln**
    
    Alle Teammitglieder antworten zeitlich unabhängig per Text oder Sprache. Sprachnachrichten werden automatisch transkribiert und können korrigiert werden.
    
    **Schritt 3 – KI-Auswertung**
    
    Nach Abschluss der Runde analysiert die KI die Antworten und erstellt eine Perspektivenkarte:
    
    Welche Funktionen werden häufig genannt?
    
    Welche Argumente stimmen überein?
    
    Wo bestehen Widersprüche?
    
    Welche einzelnen Perspektiven könnten übersehen werden?
    
    Die Auswertung soll mit Originalbeiträgen verknüpft sein, damit Aussagen überprüfbar bleiben.
    
    **Schritt 4 – Rückfragen und Klärung:** Während des Austauschs können gezielte Rückfragen gestellt werden. Nach der KI-Auswertung können offene Punkte bei Bedarf in einem weiteren Austausch geklärt werden.
    
    **Schritt 5 – Menschliche Entscheidung**
    
    Das Team nutzt die strukturierte Auswertung, um gemeinsam Prioritäten festzulegen. Die KI trifft keine eigenständigen Entscheidungen.
    
    **3. Nutzen**
    
    Weniger zeitaufwendige Abstimmungsmeetings
    
    Zeit- und ortsunabhängige Beteiligung
    
    Gleichberechtigte Möglichkeit, Perspektiven einzubringen
    
    Schnellere Strukturierung umfangreicher Rückmeldungen
    
    Nachvollziehbarere Entscheidungsgrundlagen
    
    Sichtbarkeit von abweichenden Meinungen
    
    **4. Risiken**
    
    Die KI könnte Beiträge falsch interpretieren oder wichtige Einzelmeinungen unzureichend berücksichtigen. Außerdem müssen Zugriffsrechte und der Datenschutz gewährleistet sein.
    
    Deshalb sind überprüfbare Quellenverweise, die Möglichkeit zur Korrektur und die menschliche Entscheidungshoheit entscheidend.
    
    **5. Fazit**
    
    CoFuture automatisiert nicht die Entscheidung selbst, sondern die zeitaufwendige Sammlung und Strukturierung unterschiedlicher Perspektiven.
    
    Dadurch kann die Kommunikation effizienter, transparenter und partizipativer gestaltet werden.
    
    **Kernidee:** Die KI ersetzt nicht die gemeinsame Entscheidungsfindung, sondern verbessert ihre Informationsgrundlage.