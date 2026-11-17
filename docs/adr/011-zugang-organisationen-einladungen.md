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
| Owner | Personen anlegen, entfernen und Rollen vergeben, Zugangslinks erzeugen, Passwörter selbst angelegter Konten zurücksetzen und diese Konten löschen, Organisation übergeben und löschen (wenn sonst niemand drin ist) |
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
- `invites (id, organization_id, user_id, token_hash, expires_at, used_at, created_by)`
- `teams.organization_id` (neu, Pflicht)

RLS: Personen sehen nur ihre eigene Organisation. `invites` ist für Clients gar nicht lesbar, nur über Route Handler mit Secret Key.

### Routen

- `POST /api/organizations` Organisation anlegen (beim Registrieren)
- `POST /api/organizations/[orgId]/members` Person anlegen und Link erzeugen
- `POST /api/organizations/[orgId]/members/[userId]/link` neuen Link erzeugen
- `DELETE /api/organizations/[orgId]/members/[userId]` Person entfernen
- `POST /api/invites/accept` Passwort setzen, Link verbrauchen
- Seiten: `/registrieren` (heißt jetzt „Organisation anlegen“), `/zugang/[token]`, `/app/organisation`

## Folgen

- **Datenschutz:** E-Mail-Adressen sehen nur Owner. An die KI gehen weiter nur Pseudonyme und Antworttexte. Der Anzeigename ist standardmäßig ein Pseudonym.
- **Kosten:** 0 €. Kein Mailversand nötig, solange Owner Links selbst verschicken.
- **Bestehende Daten:** Vorhandene Teams bleiben ohne Organisation und funktionieren wie bisher (Mitglieder per E-Mail). Bestehende Konten sehen in der Übersicht „Organisation anlegen“.
- **Secret Key nötig:** Personen anlegen und Links prüfen braucht `SUPABASE_SECRET_KEY` auf Vercel.
- **Teams in einer Organisation** nehmen nur Personen aus dieser Organisation auf (Auswahl aus Liste).

## Offene Fragen (Entscheidung: Constantin oder Luca)

1. Soll die freie Registrierung ganz entfallen oder nur noch über „Organisation anlegen“ gehen?
