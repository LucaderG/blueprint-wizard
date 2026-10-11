# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), und das Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

## [0.5.0] – 2026-10-11 – Phase 5: Entscheidungen & Vorschläge

### Hinzugefügt

- Seite „Entscheidungen & Vorschläge“ unter `/projekte/:projectId/entscheidungen`. Der Abschnitt „Wichtigste Entscheidungen“ zeigt bis zu 7 Kernentscheidungen, sortiert nach Hebel × Unsicherheit des Abschnitts. Jede Entscheidung hat 2–4 Optionen mit Vor- und Nachteilen, die Folge der Wahl und eine Empfehlung.
- Entscheiden mit Begründung, Verwerfen und Wieder öffnen. Die KI ermittelt die Entscheidungen über den Prompt `identify-decisions` (Version 1) und das Zod-Schema der Entscheidungen.
- Entscheidungsprotokoll mit den getroffenen Entscheiden in zeitlicher Reihenfolge, auf der Entscheidungsseite und auf der Projektseite.
- Vorschlagsmodus: Der Prompt `suggest-additions` (Version 1) schlägt Kernfunktionen, Nicht-Ziele und Risiken vor, höchstens vier je Abschnitt. Vorschläge lassen sich einzeln annehmen oder ablehnen. Angenommene Vorschläge werden als Stichpunkt an den Abschnitt angehängt, vorhandener Inhalt bleibt unverändert.
- Regelbasierte Widerspruchswarnungen mit Fundstellen in den Abschnitten und gewählten Optionen. Zusätzlich werden die Widersprüche aus der KI-Analyse angezeigt. Auf der Projektseite zeigt ein Zähler die Widersprüche an.
- ADR 0006 zu Entscheidungen, Vorschlägen und Widerspruchswarnungen.
- Tests: 1047 Unit- und Komponententests in 57 Dateien, alle grün. Neu sind Tests für Schema, Migration v2 → v3 (Fixture `src/core/blueprint/__fixtures__/project-v2.json`, Kette v1 → v3), Rangfolge, Annehmen und Ablehnen, Widerspruchsregeln mit positiven und negativen Beispielen sowie Golden Files für beide Prompts. E2E-Tests: 19, davon 2 neu in `e2e/decisions.spec.ts` („Vorschlag annehmen → erscheint im Blueprint“, „Entscheidung treffen → Protokoll, Widerspruch wird angezeigt“).

### Geändert

- Datenformat auf Version 3: Entscheidungen liegen projektweit unter `decisions` statt pro Abschnitt, neu ist die Liste `additions` für Vorschläge. Projekte aus v0.4.x werden beim Laden automatisch migriert. Alte Entscheidungen, die sich nicht übernehmen lassen, werden verworfen, statt das Projekt zu sperren.
- Der Fragenmotor kürzt zu viele KI-Fragen jetzt nach Hebel statt nach Position.

### Behoben

- Widerspruchsregeln meldeten Fehlalarme bei Formulierungen wie „Freemium“, „Login ist nicht erforderlich“, „ohne den lästigen Login“, „entfällt“ und bei zeitlicher Staffelung wie „App-Store in Phase 2“.
- Altdaten mit nur einer Option oder ohne gewählte Option sperren das Projekt nicht mehr.
- Aufzählungszeichen in KI-Vorschlägen führten zu „- - Text“. Sie werden jetzt entfernt.
- Klicks auf veraltete IDs (z. B. nach einer neuen Ermittlung) führen nicht mehr zu Fehlern.
- Fundstellen der Widersprüche werden in einem eigenen Abschnitt angezeigt.

## [0.4.0] – 2026-10-11 – Phase 4: Intelligenter Fragenmotor

### Hinzugefügt

- Fragen-Seite `/projekte/:projectId/fragen` mit Lückenanalyse: Zusammenfassung, Lücken und Widersprüche, jeweils mit den betroffenen Abschnitten. Die Analyse läuft über den Prompt `analyze-blueprint` (Version 1) und das Zod-Schema `blueprintAnalysisResultSchema`.
- Fragerunden mit 1–3 Fragen. Jede Frage lässt sich per Antwortoption, Freitext oder „Später“ beantworten. Die Begründung und der Hebel jeder Frage werden angezeigt.
- Deterministische Priorisierung in `src/core/engine/prioritization.ts`: Score aus Hebel, Unsicherheit des Abschnitts (Reifegrad) und Abhängigkeitsfaktor. Grundsatzfragen (Plattform, Zielgruppe, MVP-Umfang) kommen vor Detailfragen. Fragen mit offener Abhängigkeit oder leerer Voraussetzung werden zurückgestellt, „Später“-Fragen kommen wieder, wenn nichts anderes offen ist.
- Einarbeiten der Antworten einer Runde: Der Prompt `integrate-answers` (Version 1) formuliert die betroffenen Abschnitte neu. Vorher und Nachher werden gegenübergestellt, übernommen wird erst nach Bestätigung. Bei deutlichem Kürzen eines Abschnitts erscheint eine Warnung.
- Wörtliches Anhängen der Antworten als Stichpunkte, ohne KI. Das ist der Fallback, wenn die KI nicht erreichbar ist oder die Vorschläge verworfen werden.
- Verlauf der Fragen: Welche Frage wann und mit welcher Antwort beantwortet oder zurückgestellt wurde.
- Link „Fragen beantworten“ mit Zähler offener Fragen auf der Projektseite.
- Tests: Tabellen-Tests für die Priorisierung, Logik für Antworten und Abhängigkeiten, Golden Files für beide Prompts sowie ein Abnahmetest mit gespeicherter KI-Antwort ohne Netzwerk. E2E-Test in `e2e/interview.spec.ts`.
- ADR 0005 zum Fragenmotor.

### Geändert

- Datenformat auf Version 2: Fragen liegen projektweit unter `interview` (`questions`, `log`, `analysis`) statt pro Abschnitt. Projekte aus v0.3.x werden beim Laden automatisch migriert, alte Fragen erhalten ihren Abschnitt als `sectionId`.

### Behoben

- Nach schnellem Seitenwechsel zeigte die neue Seite kurz den Stand vor dem letzten Speichern; Seiten warten jetzt
  auf laufende Speichervorgänge.

## [0.3.1] – Fehlerbehebung KI-Anfragen

### Behoben

- „Das gewählte Modell ist gerade nicht verfügbar“ erschien bei jedem Modell, weil die App Anbieter mit Unterstützung für strukturierte Antworten erzwungen hat (`require_parameters`). Der Zwang ist entfernt.

### Hinzugefügt

- Lehnt OpenRouter eine Anfrage mit Antwortschema ab (400/404), versucht die App es einmal ohne Schemazwang, mit dem Schema im Prompt. Die Antwort wird weiterhin per Zod geprüft.
- Fehlermeldungen zeigen zusätzlich die Originalmeldung von OpenRouter („Technische Details“).

## [0.3.0] – Phase 3: Wizard-Gerüst & Einstiegspunkte

### Hinzugefügt

- Einstiegspunkte `/neu/keine-idee`, `/neu/teil-idee` und `/neu/fast-fertig` mit Erklärung, Hinweis zum API-Key, Projektnamen und Freitextfeld.
- Freitext als `.txt`- oder `.md`-Datei hochladen (beim Einstieg „fast fertig“).
- „Idee einordnen“: Die KI verteilt den Text auf die zehn Blueprint-Abschnitte und schlägt Reifegrad, Projektnamen und Kurzfassung vor. Der Prompt `classify-idea` (Version 1) liegt versioniert in `src/core/ai/prompts/`, die Antwort ist ein Zod-Schema (`classificationSchema`) über `generateStructured`. Maximal 20.000 Zeichen.
- Ohne KI starten: Legt ein leeres Projekt an. Ein eingegebener Text bleibt als eigener Inhalt im Abschnitt „Problem & Vision“ erhalten.
- Ein Projekt entsteht erst nach einer erfolgreichen KI-Antwort, Abbrechen ist möglich. Bei Fehlern entstehen keine leeren Projekte.
- Blueprint-Übersicht auf der Projektseite mit bearbeitbaren Abschnitten, Reifegrad und Herkunft des Inhalts (eigener Inhalt, KI-Vorschlag, bestätigt).
- KI-Vorschläge lassen sich pro Abschnitt übernehmen; eigener Inhalt wird von der KI nie überschrieben.
- Rückgängig und Wiederholen über Schaltflächen sowie Strg/Cmd+Z, Strg/Cmd+Umschalt+Z und Strg+Y (bis zu 50 Schritte pro Seitenbesuch).
- Automatisches Speichern 600 ms nach der letzten Änderung, mit Speicherstatus. Ausstehende Änderungen werden beim Verlassen der Seite und beim direkten Wechsel zwischen zwei Projekten gespeichert.
- Änderungen an Abschnitten als reine Funktionen (`src/core/blueprint/editing.ts`) und Verlauf (`history.ts`), jeweils mit Tests.
- ADR 0004 zu Einordnung und Bearbeitung.

### Geändert

- Die Startseite zeigt die drei Einstiegspunkte als aktive Auswahl.
- Standardmodell ist jetzt `anthropic/claude-haiku-5.5` (vorher `anthropic/claude-sonnet-5.5`). Bereits gespeicherte Einstellungen bleiben unverändert.

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
