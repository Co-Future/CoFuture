# ADR 008: Login mit E-Mail und Passwort

**Status:** Vorgeschlagen, 12.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Geplant war ein Magic Link. Dafür muss die App E-Mails verschicken: Der eingebaute Supabase-Versand ist nur zum Testen gedacht, echter Versand braucht Resend und eine eigene Domain.

## Entscheidung

Supabase Auth mit E-Mail und Passwort, E-Mail-Bestätigung abgeschaltet. Magic Link später.

## Folgen

- Kein Mailversand und keine Domain nötig, 0 € Kosten.
- Session über `@supabase/ssr` (Cookies).
- Für Magic Link später: Resend + Domain (ca. 5–15 €/Jahr).
