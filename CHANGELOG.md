# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), und das Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

## [0.0.1] – Phase 0: Fundament

### Hinzugefügt

- Projektgerüst mit Vite 8, React 19 und TypeScript im Strict-Modus, Pfad-Alias `@/` für `src/`.
- Ordnerstruktur `src/app`, `src/features`, `src/core`, `src/shared`, `src/test`, `e2e`.
- Tailwind CSS v4 und shadcn/ui-Konfiguration (`components.json`), erste Komponente `Button` und Helfer `cn`.
- React Router mit Layout, Startseite (drei Einstiegspunkte), Einstellungsseite (Platzhalter) und 404-Seite.
- i18next mit deutschen Texten in `src/shared/i18n/locales/de.json` und typisierten Keys.
- Zustand als Abhängigkeit für späteres State-Management.
- ESLint (inkl. Regel: `src/core` darf kein React und keine UI-Schichten importieren) und Prettier mit Tailwind-Plugin.
- Husky-Pre-Commit-Hook mit lint-staged.
- Vitest mit jsdom, Testing Library und Abdeckungsbericht (Mindestwert 70 % Zeilen).
- MSW-Testserver, der nicht gemockte Netzwerkaufrufe als Fehler behandelt.
- Smoke-Tests: Komponententests für Startseite, Navigation und 404-Seite; Playwright-E2E-Test „App startet und zeigt die Startseite“.
- GitHub-Actions-Workflow: Lint → Typcheck → Unit-Tests → Build → E2E.
- Dokumentation: `README.md`, `CLAUDE.md`, `CHANGELOG.md`, Implementierungsplan und ADRs in `docs/adr/` (Vorlage, ADR 0001 zum Tech-Stack).
