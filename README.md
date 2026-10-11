# Blueprint-Wizard

Eine KI-gestützte Web-App, die dich von jedem Ausgangspunkt – keine Idee, halbe Idee oder fast fertiges Konzept – zu einem fertigen Projekt-Blueprint führt. Am Ende stehen ein Blueprint als Markdown und vibe-coding-fertige Dateien (z. B. `CLAUDE.md`, Aufgabenliste, Start-Prompt).

Die App läuft komplett im Browser: kein eigener Server, kein Konto. Projekte bleiben lokal auf deinem Gerät, die KI wird über deinen eigenen OpenRouter-Key angesprochen (ab Phase 2).

**Projektstatus:** Phase 8 – Qualität & Politur (v0.8.0). Die App gibt es jetzt auch auf Englisch und im Dunkelmodus (Einstellungen → Darstellung), sie lässt sich als App installieren und läuft danach offline. Oben rechts zeigt sie die KI-Kosten der aktuellen Sitzung. Die drei Einstiegspunkte, Ideenfindung, Fragenmotor, Entscheidungen und Vorschläge führen zum bearbeitbaren Blueprint. „Blueprint fertigstellen“ zeigt den Reife-Check und eine Vorschau von `BLUEPRINT.md`, `CLAUDE.md`, `AGENTS.md`, `TASKS.md` und `START-PROMPT.md`. Dateien lassen sich einzeln oder als ZIP herunterladen, der Start-Prompt lässt sich kopieren. Der Export braucht keinen API-Key; offene Punkte bleiben sichtbar und verhindern den Export nicht. Details: [Implementierungsplan](docs/implementierungsplan.md).

## Blueprint fürs Coding exportieren

1. Öffne ein Projekt und wähle **Blueprint fertigstellen**.
2. Prüfe den Reife-Check. Leere/vage Abschnitte, nicht übernommene KI-Inhalte, offene Fragen, Entscheidungen, Vorschläge und mögliche Widersprüche bleiben als Hinweise im Paket. Frühere KI-Analysen sind ausdrücklich als zu prüfender Stand markiert.
3. Sieh dir jede Datei in der Vorschau an und lade **Alles als ZIP** herunter.
4. Entpacke die fünf Dateien in einen leeren Projektordner, öffne diesen mit deinem KI-Coding-Tool und füge den kopierten **Start-Prompt** ein.

`BLUEPRINT.md` enthält die zehn Abschnitte, offene Punkte, Entscheidungsprotokoll und Fragenverlauf. `CLAUDE.md` und `AGENTS.md` enthalten denselben Kontext und dieselben Arbeitsregeln. `TASKS.md` bewahrt die vorhandene Roadmap und ergänzt eine ausdrücklich als Vorlage gekennzeichnete Phasenliste mit Aufgaben und Abnahmekriterien. Die Projekt-Roadmap hat Vorrang; fehlende Anforderungen muss das Coding-Tool vor dem betroffenen Schritt klären.

Der Export erzeugt Dateien lokal aus dem gespeicherten Projekt und verändert es nicht. Er enthält keine App-Einstellungen oder API-Keys. Die JSON-Sicherung über die Projektliste bleibt für Import und Wiederherstellung verfügbar; das Markdown-Paket dient zum Coding-Start.

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

| Skript                  | Zweck                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run dev`           | Startet den Vite-Entwicklungsserver mit Hot Reload.                                             |
| `npm run build`         | Typcheck (`tsc -b`) und Produktions-Build nach `dist/`.                                         |
| `npm run preview`       | Liefert den Build aus `dist/` lokal aus.                                                        |
| `npm run lint`          | Prüft den Code mit ESLint.                                                                      |
| `npm run format`        | Formatiert alle Dateien mit Prettier.                                                           |
| `npm run format:check`  | Prüft, ob alle Dateien Prettier-konform formatiert sind.                                        |
| `npm run typecheck`     | TypeScript-Typcheck ohne Build.                                                                 |
| `npm run test`          | Führt alle Unit- und Komponententests einmal aus (Vitest).                                      |
| `npm run test:watch`    | Vitest im Watch-Modus.                                                                          |
| `npm run test:coverage` | Tests mit Abdeckungsbericht (Mindestabdeckung: 70 % insgesamt, 80 % Zeilen und Zweige im Kern). |
| `npm run test:e2e`      | E2E-Tests mit Playwright (baut die App und startet `preview` auf Port 4173).                    |
| `npm run check`         | Alles vor dem Commit: Lint, Formatprüfung, Typcheck, Tests mit Abdeckung.                       |
| `npm run prepare`       | Richtet Husky ein (läuft automatisch bei `npm install`).                                        |

Beim Commit führt ein Husky-Hook `lint-staged` aus: ESLint und Prettier auf den geänderten Dateien.

## Ordnerstruktur

```
src/
  app/          Routing, Layout, 404-Seite
  features/     Ein Ordner pro Feature (aktuell: home, settings, wizard, projects, blueprint, interview, decisions, ideation, export, ai)
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
