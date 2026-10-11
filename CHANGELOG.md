# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), und das Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

## [0.2.0] – Phase 2: Einstellungen & OpenRouter-Anbindung

### Hinzugefügt

- KI-Schnittstelle `AiProvider` mit `OpenRouterProvider` (Antworten und Streaming) und `MockAiProvider` für Tests.
- Einheitliche KI-Fehler (`AiError`) für ungültigen Key, fehlendes Guthaben, Rate-Limit, Timeout, Netzwerk, nicht verfügbares Modell, Fehler mitten im Stream und mehr.
- Strukturierte Antworten: Zod-Schema → JSON-Schema, Validierung und genau ein automatischer Reparaturversuch (`generateStructured`).
- Key-Prüfung und Modellliste über die OpenRouter-API; Standardmodell `anthropic/claude-sonnet-5.5`.
- Einstellungsspeicher in `localStorage` mit Rückfall auf Standardwerte pro Feld.
- Einstellungsseite mit OpenRouter-API-Key (anzeigen/verbergen, speichern, „Verbindung testen“ mit Guthaben-Anzeige, „Key löschen“ mit Bestätigung).
- Modellauswahl mit Textfilter, Filter für strukturierte Antworten, Preisen pro Million Tokens und manueller Modell-ID bei Ladefehler.
- Einstellungen für Temperatur und Antwortsprache.
- Hinweis auf der Startseite, solange kein API-Key hinterlegt ist.
- Zuordnung aller KI-Fehlercodes zu deutschen Meldungen (`ai.errors.*`).
- E2E-Tests für die Einstellungen; OpenRouter wird dort per `page.route` gemockt.
- ADR 0003 zur KI-Anbindung.

## [0.1.0] – Phase 1: Datenmodell & Speicherung

### Hinzugefügt

- Blueprint-Datenmodell als Zod-Schemas: Projekt, Blueprint mit 10 festen Abschnitten, Reifegrad (leer/vage/entschieden), Entscheidungen mit Optionen und Hebel, Fragen.
- Gewichteter Vollständigkeits-Score pro Abschnitt und gesamt.
- Versioniertes Projektformat mit Migrationssystem (`schemaVersion`, `migrateProject`).
- JSON-Exportformat mit Formatkennung; Import migriert ältere Dateien und vergibt immer eine neue ID.
- `ProjectRepository`-Schnittstelle mit IndexedDB-Implementierung (Dexie) und Memory-Implementierung für Tests, geprüft durch eine gemeinsame Vertrags-Testsuite.
- Projektliste auf der Startseite: anlegen, umbenennen, duplizieren, löschen (mit Bestätigung), exportieren, importieren.
- Projektseite mit allen Abschnitten, Reifegrad und Fortschrittsbalken.
- Barrierearmer Dialog, Download-Helfer, Slugify- und Format-Helfer.
- E2E-Abnahmetest: Projekt anlegen, Seite neu laden, Projekt ist noch da; dazu Tests für Umbenennen, Duplizieren, Löschen und Export/Import.
- ADR 0002 zu Datenmodell und Speicherung.

### Geändert

- Abdeckungs-Mindestwert für `src/core/**`: 80 % Zeilen und Zweige.
- Build teilt Bibliotheken in eigene Chunks (`react`, `vendor`), damit keine Datei über 500 kB liegt.

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
