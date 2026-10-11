# Blueprint-Wizard

Eine KI-gestützte Web-App, die dich von jedem Ausgangspunkt – keine Idee, halbe Idee oder fast fertiges Konzept – zu einem fertigen Projekt-Blueprint führt. Am Ende stehen ein Blueprint als Markdown und vibe-coding-fertige Dateien (z. B. `CLAUDE.md`, Aufgabenliste, Start-Prompt).

Die App läuft komplett im Browser: kein eigener Server, kein Konto. Projekte bleiben lokal auf deinem Gerät, die KI wird über deinen eigenen OpenRouter-Key angesprochen (ab Phase 2).

**Projektstatus:** Phase 5 – Entscheidungen & Vorschläge abgeschlossen (v0.5.0). Die Seite „Entscheidungen & Vorschläge“ zeigt die wichtigsten Entscheidungen des Blueprints, sortiert nach Hebel und Unsicherheit: bis zu sieben Kernentscheidungen mit Optionen, Vor- und Nachteilen, Folge und Empfehlung. Du entscheidest mit Begründung, verwirfst Entscheidungen oder öffnest sie wieder. Das Entscheidungsprotokoll hält alle getroffenen Entscheidungen fest. Der Vorschlagsmodus schlägt Kernfunktionen, Nicht-Ziele und Risiken vor, die du einzeln annimmst oder ablehnst. Widerspruchswarnungen zeigen Stellen, an denen sich Punkte gegenseitig ausschließen. Der Ablauf aus den Phasen 3 und 4 bleibt erhalten: Auf der Startseite wählst du deinen Einstieg (keine Idee, Teil-Idee oder fast fertig), gibst Projektnamen und Freitext ein und lässt die KI deinen Text den Blueprint-Abschnitten zuordnen. Im Blueprint bearbeitest du Abschnitte und Reifegrad, übernimmst KI-Vorschläge und machst Änderungen rückgängig; gespeichert wird automatisch. Über „Fragen beantworten“ analysiert die KI den Blueprint, die Fragen kommen in Runden zu 1–3 Fragen. Die Antworten fließen erst nach deiner Bestätigung in die Abschnitte ein. Details: [Implementierungsplan](docs/implementierungsplan.md).

## Quickstart

Voraussetzung: **Node.js 22** (siehe `.nvmrc`).

```bash
npm install
npm run dev
```

Die App läuft dann unter der von Vite angezeigten Adresse (standardmäßig `http://localhost:5173`).

Für E2E-Tests einmalig die Playwright-Browser installieren:

```bash
npx playwright install chromium
```

## npm-Skripte

| Skript                  | Zweck                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`           | Startet den Vite-Entwicklungsserver mit Hot Reload.                          |
| `npm run build`         | Typcheck (`tsc -b`) und Produktions-Build nach `dist/`.                      |
| `npm run preview`       | Liefert den Build aus `dist/` lokal aus.                                     |
| `npm run lint`          | Prüft den Code mit ESLint.                                                   |
| `npm run format`        | Formatiert alle Dateien mit Prettier.                                        |
| `npm run format:check`  | Prüft, ob alle Dateien Prettier-konform formatiert sind.                     |
| `npm run typecheck`     | TypeScript-Typcheck ohne Build.                                              |
| `npm run test`          | Führt alle Unit- und Komponententests einmal aus (Vitest).                   |
| `npm run test:watch`    | Vitest im Watch-Modus.                                                       |
| `npm run test:coverage` | Tests mit Abdeckungsbericht (Mindestabdeckung: 70 % Zeilen).                 |
| `npm run test:e2e`      | E2E-Tests mit Playwright (baut die App und startet `preview` auf Port 4173). |
| `npm run check`         | Alles vor dem Commit: Lint, Formatprüfung, Typcheck, Tests mit Abdeckung.    |
| `npm run prepare`       | Richtet Husky ein (läuft automatisch bei `npm install`).                     |

Beim Commit führt ein Husky-Hook `lint-staged` aus: ESLint und Prettier auf den geänderten Dateien.

## Ordnerstruktur

```
src/
  app/          Routing, Layout, 404-Seite
  features/     Ein Ordner pro Feature (aktuell: home, settings, wizard, projects, blueprint, interview, decisions, ai)
  core/         Reine TypeScript-Logik ohne React (ab Phase 1: Datenmodell, Engine, KI, Speicherung)
  shared/
    ui/         UI-Komponenten im shadcn/ui-Stil
    lib/        Hilfsfunktionen (z. B. cn)
    i18n/       i18next-Setup und Übersetzungen (locales/de.json)
  test/         Test-Setup, MSW-Server und Render-Helfer
e2e/            Playwright-Tests
docs/
  adr/          Architekturentscheidungen (ADRs)
  implementierungsplan.md
```

Unit- und Komponententests liegen als `*.test.ts(x)` direkt neben dem Code.

## Tech-Stack

Vite 8, React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui-Komponenten, React Router, i18next (Deutsch zuerst), Zustand, Vitest + Testing Library + MSW, Playwright, ESLint + Prettier, Husky + lint-staged. Begründung: [ADR 0001](docs/adr/0001-tech-stack.md).

## Weitere Dokumente

- [Implementierungsplan](docs/implementierungsplan.md) – Ziele, Architektur, Phasen
- [CLAUDE.md](CLAUDE.md) – Arbeitsregeln für KI-Coding-Tools
- [CHANGELOG.md](CHANGELOG.md) – Änderungen pro Version
- [docs/adr/](docs/adr/) – Architekturentscheidungen
