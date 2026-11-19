## Was

<!-- Kurz: was ändert sich? -->

## Warum

<!-- Schritt aus der README (Stand) oder docs/roadmap.md, Problem, Ziel -->

## Wie getestet

- [ ] `pnpm lint` und `pnpm build` laufen lokal
- [ ] Im Browser geprüft (hell, dunkel, Handy-Breite)
- [ ] Screenshot bei UI-Änderungen angehängt

## Checkliste

- [ ] Keine Secrets oder echten Personendaten im Code
- [ ] Hält die Designsprache ein (Tokens statt fester Farben, Du-Ansprache, Buttons Verb + Objekt)
- [ ] Hält die Gestaltungsprinzipien ein (Belege, Pseudonyme, keine Personenbewertung)
- [ ] `CHANGELOG.md` unter `[Unreleased]` ergänzt (entfällt bei reinen Doku-, Test- oder CI-PRs)
- [ ] Doku angepasst, wo nötig ([was muss ich anpassen?](https://github.com/Co-Future/CoFuture/blob/main/docs/README.md#was-muss-ich-anpassen)): README *Stand*, `docs/roadmap.md`, `docs/tech-stack.md`, `docs/architecture.md`, `docs/api.md`
- [ ] Version nicht erhöht (nur im Release-PR)
- [ ] Höchstens eine neue Migration, bestehende Migrationen unverändert
