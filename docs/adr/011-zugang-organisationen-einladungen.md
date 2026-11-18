# ADR 011: Zugang über Organisationen und Einladungslinks

**Status:** Vorgeschlagen und umgesetzt, 17.11.2026 (Freigabe durch Constantin oder Luca)

## Kontext

Heute registriert sich jede Person selbst. Wer ein Team anlegt, ist Leitung und fügt andere per E-Mail hinzu, wenn diese schon ein Konto haben. Das hat drei Schwächen:

- Jede Person muss sich vorher selbst registrieren, bevor sie ins Team kann.
- Es gibt keinen Rahmen über den Teams. Eine Firma mit mehreren Teams sieht CoFuture als lose Sammlung.
- Die Registrierung steht allen offen.

Wunsch aus dem Team: Eine Organisation anlegen, darin Personen und Teams verwalten und angelegten Personen einen Link zum Einstieg geben. Beim ersten Login setzt die Person ein eigenes Passwort.

**Scope:** Mandanten sind ausdrücklich gewollt (Entscheidung 17.11.2026, vorher Out of Scope). Organisationen sind die Mandanten von CoFuture. Wir starten schlank: Name, Mitglieder, Teams. Eine Person kann in mehreren Organisationen sein und wechselt oben im Menü links (die Auswahl liegt in einem Cookie, die Datenbank prüft immer die Mitgliedschaft). Das Datenmodell ist so angelegt, dass es sich ausbauen lässt, z. B. um Einstellungen je Organisation oder mehrere Organisationen pro Person.

## Vorschlag

### Rollen

| Rolle | Darf |
| --- | --- |
| Owner | Personen anlegen oder einladen, Einladungen zurückziehen, Personen entfernen und Rollen vergeben, Zugangslinks für Konten der Organisation erzeugen, Passwörter selbst angelegter Konten zurücksetzen und diese Konten löschen, Organisation übergeben und löschen (wenn sonst niemand drin ist) |
| Mitglied | in Teams arbeiten, Teams und Runden anlegen |
| Gast | sieht nur die Teams, in die er eingeladen ist, und nur die Personen daraus; antwortet auf Runden, startet keine, legt keine Teams an |
| Team-Leitung | Mitglieder aus der Organisation hinzufügen, Team übergeben und löschen (wenn sonst niemand drin ist) |

Owner sehen **keine** zusätzlichen Auswertungen. Gleiche Sicht für alle gilt weiter. Es gibt immer mindestens einen Owner.

**Konten der Organisation:** Legt ein Owner eine Person neu an, verwaltet die Organisation dieses Konto (`organization_members.managed`). Solange die Person in keiner anderen Organisation ist, kann ein Owner ihr Passwort zurücksetzen (altes Passwort wird ungültig, neuer Zugangslink) oder das Konto ganz löschen. Hat sich jemand selbst registriert, kann ein Owner die Person nur aus der Organisation entfernen.

### Ablauf

1. **Organisation anlegen.** Auf dem Login-Screen gibt es „Organisation anlegen“. Wer das tut, registriert sich und wird Owner. Die freie Registrierung ohne Organisation entfällt.
2. **Personen anlegen.** Ein Owner gibt Anzeigename (Pseudonym) und E-Mail ein. Der Server legt das Konto mit `auth.admin.createUser` an (Secret Key, nur serverseitig) und erzeugt einen **Einladungslink**.
3. **Link weitergeben.** Solange es keinen Mailversand gibt (ADR 008), kopiert der Owner den Link und schickt ihn selbst, z. B. per Chat. Mit Resend geht das später automatisch per E-Mail.
4. **Erster Login.** Der Link öffnet „Passwort festlegen“. Die Person wählt ihr Passwort und ist angemeldet. Der Link ist danach verbraucht.
5. **Teams.** Owner und Mitglieder legen Teams an und ordnet Personen zu. Team-Leitungen können Personen aus der eigenen Organisation hinzufügen, ohne E-Mail-Adresse zu tippen (Auswahl aus Liste).

### Bestehende Konten: Einladung mit Bestätigung (entschieden 17.11.2026)

Bis dahin trat eine Person mit bestehendem Konto sofort bei, wenn ein Owner ihre E-Mail-Adresse eingab. Sie wurde nicht gefragt, und ein Owner konnte danach einen Zugangslink für sie erzeugen und damit ihr Passwort neu setzen. Jetzt gilt:

- **Kein Konto vorhanden:** wie bisher. Das Konto wird angelegt und von der Organisation verwaltet, dazu gibt es einen Zugangslink.
- **Konto vorhanden:** Es entsteht nur eine Einladung (`organization_invitations`) mit Rolle und Teams. Die Person sieht sie nach dem Login in der Übersicht und in der Seitenleiste und nimmt an oder lehnt ab. Erst beim Annehmen wird sie Mitglied und kommt in die Teams, die es dann noch gibt. Owner sehen offene Einladungen auf der Organisationsseite und können sie zurückziehen.
- **Keine Überschneidungen:** höchstens eine offene Einladung je Person und Organisation, keine Einladung an Mitglieder. Wird jemand auf anderem Weg Mitglied, verschwindet die Einladung (Trigger). Einladungen setzen nie ein Passwort.
- **Zugangslinks nur für Konten der Organisation:** Owner erzeugen Links nur für Konten, die ihre Organisation angelegt hat und die in keiner anderen Organisation sind. Wer sich selbst registriert hat oder per Einladung beigetreten ist, meldet sich mit dem eigenen Passwort an. So kann kein Owner ein fremdes Konto übernehmen.
- **Teams:** Ins Team einer Organisation kommt nur, wer Mitglied der Organisation ist. Ein Trigger auf `team_members` prüft das auf allen Wegen. Personen aus der Organisation fügt die Team-Leitung weiter direkt hinzu.

Begriffe in der Oberfläche: **Zugangslink** (Passwort festlegen, neues Konto) und **Einladung** (bestehendes Konto, annehmen oder ablehnen).

### Einladungslink statt Initialpasswort (entschieden)

Zuerst war ein Link plus Initialpasswort im Gespräch. Entschieden ist **nur der Link** als einmaliger Anmeldecode:

- Link und Initialpasswort laufen fast immer über denselben Kanal. Wer den Link abfängt, hat auch das Passwort. Das Passwort bringt keine zusätzliche Sicherheit.
- Ein Schritt weniger für die Person: Link öffnen, Passwort setzen, fertig.
- Kein Passwort im Klartext, das irgendwo im Chat liegen bleibt.

Der Link enthält ein zufälliges Token (32 Byte). In der Datenbank liegt nur dessen Hash. Gültig 72 Stunden, nur einmal nutzbar, von Ownern jederzeit neu erzeugbar.

Der Link ist auch der Weg zurück, wenn jemand sein Passwort vergessen hat: Ein Owner erzeugt einen neuen Link (bei Konten der Organisation mit „Passwort zurücksetzen“). Ältere, unbenutzte Links werden dabei ungültig.

### Datenmodell (eine Migration)

- `organizations (id, name, created_at)`
- `organization_members (organization_id, user_id, role: 'admin' | 'member', joined_at)`
- `invites (id, organization_id, user_id, token_hash, expires_at, used_at, created_by)` (Zugangslinks)
- `organization_invitations (id, organization_id, user_id, role, team_ids, invited_by, created_at)` (Einladungen an bestehende Konten, Nachtrag 17.11.2026)
- `teams.organization_id` (neu, Pflicht)

RLS: Personen sehen nur ihre eigene Organisation. `invites` ist für Clients gar nicht lesbar, nur über Route Handler mit Secret Key.

### Routen

- `POST /api/organizations` Organisation anlegen (beim Registrieren)
- `POST /api/organizations/[orgId]/members` Person anlegen und Link erzeugen
- `POST /api/organizations/[orgId]/members/[userId]/link` neuen Link erzeugen
- `DELETE /api/organizations/[orgId]/members/[userId]` Person entfernen
- `POST /api/invites/accept` Passwort setzen, Link verbrauchen
- `POST /api/invitations/[id]/accept`, `DELETE /api/invitations/[id]` Einladung annehmen oder ablehnen
- `DELETE /api/organizations/[orgId]/invitations/[id]` Einladung zurückziehen (Owner)
- Seiten: `/registrieren` (heißt jetzt „Organisation anlegen“), `/zugang/[token]`, `/app/organisation`

## Folgen

- **Datenschutz:** E-Mail-Adressen sehen nur Owner. An die KI gehen weiter nur Pseudonyme und Antworttexte. Der Anzeigename ist standardmäßig ein Pseudonym.
- **Kosten:** 0 €. Kein Mailversand nötig, solange Owner Links selbst verschicken.
- **Bestehende Daten:** Vorhandene Teams bleiben ohne Organisation und funktionieren wie bisher (Mitglieder per E-Mail). Bestehende Konten sehen in der Übersicht „Organisation anlegen“.
- **Secret Key nötig:** Personen anlegen und Links prüfen braucht `SUPABASE_SECRET_KEY` auf Vercel.
- **Teams in einer Organisation** nehmen nur Personen aus dieser Organisation auf (Auswahl aus Liste).

## Offene Fragen (Entscheidung: Constantin oder Luca)

1. Soll die freie Registrierung ganz entfallen oder nur noch über „Organisation anlegen“ gehen?
