# Blueprint-Wizard

Eine KI-gestützte Web-App, die dich von jedem Ausgangspunkt – keine Idee, halbe Idee oder fast fertiges Konzept – zu einem fertigen Projekt-Blueprint führt. Am Ende stehen ein Blueprint als Markdown und vibe-coding-fertige Dateien (z. B. `CLAUDE.md`, Aufgabenliste, Start-Prompt).

Die App läuft komplett im Browser: kein eigener Server, kein Konto. Projekte bleiben lokal auf deinem Gerät, die KI wird über deinen eigenen OpenRouter-Key angesprochen (ab Phase 2).

**Projektstatus:** Phase 6 – Ideenfindung von Null abgeschlossen (v0.6.0). Wer ohne Idee startet, beantwortet einen kurzen Fragebogen (Interessen, Ärgernisse, Fähigkeiten, Lernziel, Zeit, Plattform) und bekommt passende Projektideen mit Aufwand, Neuheit und Lernwert. Ideen lassen sich abwandeln, kombinieren und neu würfeln; die gewählte Idee wird direkt zum Start-Blueprint. Bei Teil-Idee oder fast fertigem Konzept ordnet die KI deinen Text den Blueprint-Abschnitten zu. Im Blueprint bearbeitest du Abschnitte und Reifegrad, gespeichert wird automatisch. „Fragen beantworten“ zeigt alle offenen Fragen auf einmal und arbeitet die Antworten mit einem Klick ein. „Entscheidungen & Vorschläge“ zeigt die wichtigsten Entscheidungen mit Optionen und Empfehlung, schlägt Ergänzungen vor und warnt vor Widersprüchen. Details: [Implementierungsplan](docs/implementierungsplan.md).

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
