# CLAUDE.md – Arbeitsregeln für KI-Coding-Tools

Kontext: Blueprint-Wizard ist eine lokale Web-App (SPA), die Nutzer zu einem Projekt-Blueprint führt. Ziele, Architektur und Phasen stehen im [Implementierungsplan](docs/implementierungsplan.md). Aktueller Stand: **Phase 5 abgeschlossen** (v0.5.0), nächste Phase: 6 – Ideenfindung von Null.

## Stack

- Vite 8, React 19, TypeScript strict (inkl. `noUncheckedIndexedAccess`)
- Tailwind CSS v4, Komponenten im shadcn/ui-Stil in `src/shared/ui`, Icons von `lucide-react`
- React Router, i18next (Deutsch zuerst); State bisher über einfache Hooks, Zustand ist installiert und kommt bei Bedarf
- Vitest + Testing Library + MSW, Playwright für E2E
- ESLint + Prettier, Husky + lint-staged
- Zod 4 für alle Datenschemas (`src/core/blueprint/schema.ts`), Dexie 4 für IndexedDB (`src/core/storage`)
- OpenRouter als KI-Anbieter (`src/core/ai`, ADR 0003); Einstellungen in `localStorage` (`src/core/settings`).
- Pfad-Alias: `@/` zeigt auf `src/`.

## Architekturregeln

- **`src/core/` kennt kein React.** Kein Import von `react`, `react-*`, `@/app/*` oder `@/features/*`. Das erzwingt ESLint (`no-restricted-imports` in `eslint.config.js`).
- **`src/features/<feature>/`**: ein Ordner pro Feature (Seiten, feature-eigene Komponenten und Hooks).
- **`src/shared/`**: wiederverwendbare UI-Komponenten (`ui/`), Utils (`lib/`), i18n (`i18n/`).
- **`src/app/`**: Routing, Layout, App-weite Provider.
- **Keine hart codierten UI-Texte.** Alle Texte als i18n-Keys in `src/shared/i18n/locales/de.json` und im Code über `t('...')`. Keys sind über `i18next.d.ts` typisiert.
- Typ-Importe mit `import type` (ESLint-Regel `consistent-type-imports`).
- **Bezeichner im Code sind Englisch**, Kommentare, Doku und UI-Texte Deutsch (ADR 0002).

## Datenmodell und Speicherung

- Das Zod-Schema in `src/core/blueprint/schema.ts` ist die Quelle der Wahrheit; Typen werden daraus abgeleitet.
- **Schemaänderung = Migration:** `CURRENT_SCHEMA_VERSION` erhöhen, Eintrag in `PROJECT_MIGRATIONS` (`migrations.ts`) ergänzen, Test mit echten Altdaten schreiben.
- Der Zustand des Fragenmotors liegt projektweit in `project.interview` (`questions`, `log`, `analysis`); Schemaversion 2 (Migration v1 → v2 in `migrations.ts`).
- Entscheidungen liegen projektweit in `project.decisions`, Ergänzungsvorschläge in `project.additions`; Schemaversion 3 (Migration v2 → v3 in `migrations.ts`).
- Komponenten greifen nur über `useProjectRepository()` auf Projekte zu, nie direkt auf Dexie.
- Neue Repository-Logik gehört in `projectOperations.ts`, damit IndexedDB- und Memory-Variante gleich bleiben; die Vertrags-Testsuite `projectRepository.contract.ts` prüft beide.

## Bearbeiten von Projekten

- Seiten bearbeiten Projekte nur über `useProjectEditor` (`src/features/projects/useProjectEditor.ts`): Bearbeiten, Rückgängig/Wiederholen und automatisches Speichern.
- Die Änderungen selbst sind reine Funktionen in `src/core/blueprint/editing.ts` (z. B. `updateSection`, `acceptSuggestion`), die ein neues Projekt zurückgeben.
- KI-Inhalte landen über `applyClassification` (`src/core/engine/classification.ts`) als `source: 'aiSuggestion'`. Eigener Inhalt des Nutzers (`source: 'user'`) wird nie überschrieben.

## Fragenmotor

- Die Reihenfolge der Fragen bestimmt nur `src/core/engine/prioritization.ts`, nie die KI.
- KI-Ergebnisse der Lückenanalyse übernimmt `applyAnalysis` (`src/core/engine/interview.ts`), das Eingaben bereinigt.
- Antworten und „Später“ laufen über `answerQuestion` / `deferQuestion`, jeweils mit Verlaufseintrag.
- Einarbeiten der Antworten nur als Vorschlag: `integrateAnswers` → Bestätigung → `applyIntegration`.
- Die UI nutzt den Fragenmotor ausschließlich über `useInterview(editor)` (`src/features/interview/useInterview.ts`).

## Entscheidungen & Vorschläge

- Die Rangfolge der Entscheidungen bestimmt nur `rankDecisions` (`src/core/engine/decisions.ts`), nie die KI.
- KI-Ergebnisse übernehmen `applyDecisionCandidates` und `applyAdditionCandidates`; sie bereinigen die Eingaben.
- Zustandsänderungen laufen über `decide`, `reopenDecision`, `dismissDecision`, `acceptAddition` und `rejectAddition`.
- Widersprüche erkennt `detectContradictions` (`src/core/engine/contradictions.ts`) mit festen Regeln. Eine neue Regel braucht einen positiven und einen negativen Testfall sowie den i18n-Text `decisions.contradictions.rules.<id>`.
- Die UI nutzt das Feature ausschließlich über `useDecisions(editor)` (`src/features/decisions/useDecisions.ts`).
- Einzelne KI-Aufgaben in Features laufen über `useAiTask` (`src/features/ai/useAiTask.ts`).

## KI-Aufrufe

- Features holen den Anbieter über `useAiProvider()` (`null` ohne Key → `ApiKeyNotice` bzw. Link zu den Einstellungen zeigen). Nie direkt `fetch` auf OpenRouter.
- Strukturierte Antworten immer über `generateStructured()` mit Zod-Schema. Im Schema `.nullable()` statt `.optional()` (Strict-Modus).
- Fehler sind `AiError`; Meldungen kommen über `aiErrorKey()` aus `src/features/settings/aiErrors.ts` (`ai.errors.*`).
- Prompts liegen als Dateien `src/core/ai/prompts/<name>.ts`. Jede Datei exportiert eine ID- und eine VERSION-Konstante (`<NAME>_PROMPT_ID`, `<NAME>_PROMPT_VERSION`) sowie eine `build<Name>Messages(...)`-Funktion. Bei inhaltlichen Änderungen am Prompt die VERSION erhöhen.

## Tests

- **Tests rufen nie echte APIs auf.** MSW läuft in jedem Test mit `onUnhandledRequest: 'error'` (`src/test/setup.ts`); nicht gemockte Requests lassen den Test fehlschlagen. Handler kommen in `src/test/msw/handlers.ts` oder per `server.use(...)` im Test.
- Unit- und Komponententests liegen neben dem Code als `*.test.ts` / `*.test.tsx`.
- E2E-Tests liegen in `e2e/` (Playwright, Chromium).
- Seiten testen mit `renderRoute('/pfad', { repository })` aus `src/test/render.tsx` (Standard: frisches `MemoryProjectRepository`).
- KI in Tests: `renderRoute(path, { settings: { apiKey: 'x' }, aiProvider: new MockAiProvider([...]) })`; OpenRouter-HTTP-Mocks in `src/test/msw/openrouter.ts`, in E2E per `page.route('https://openrouter.ai/api/v1/**')`.
- Testdaten für Projekte: `makeProject()` und `withMaturity()` aus `src/core/blueprint/testing.ts`.
- Neue Logik bekommt Tests. Abdeckung für `src/core/` ≥ 80 % Zeilen und Zweige (in `vitest.config.ts` erzwungen).
- Prompts haben Golden Files in `src/core/ai/prompts/__golden__`. Bei einer bewussten Prompt-Änderung die VERSION erhöhen, mit `npx vitest run -u src/core/ai/prompts` neu erzeugen und die Diffs prüfen.
- Abnahmetest des Fragenmotors: `src/core/engine/acceptance.test.ts` mit Fixture (gespeicherte KI-Antwort, ohne Netzwerk).

## Vor jedem Commit

```bash
npm run check      # Lint, Formatprüfung, Typcheck, Tests mit Abdeckung
npm run test:e2e   # E2E-Tests (baut die App)
```

Der Pre-Commit-Hook führt zusätzlich `lint-staged` aus (ESLint + Prettier auf geänderten Dateien).

## Phasen-Übergang (Checkliste, aus Plan Abschnitt 5)

Am Ende jeder Phase abarbeiten:

1. **Tests:** Alle Unit-, Integrations- und E2E-Tests grün; neue Logik hat Tests. Abdeckung für `core/` ≥ 80 %.
2. **Qualität:** Lint, Typcheck und Build ohne Fehler/Warnungen; CI grün.
3. **Manueller Test:** Abnahmekriterien der Phase einmal von Hand durchspielen (bei KI-Features mit echtem Key).
4. **Refactoring-Fenster:** Kurzer Aufräum-Durchgang – Duplikate, Namen, tote Pfade.
5. **Dokumentation:** README/`CLAUDE.md` aktualisiert, Architekturentscheidungen als ADR, `CHANGELOG.md`-Eintrag.
6. **Datenkompatibilität:** Lädt ein Projekt aus der Vorphase noch? Bei Schemaänderung: Migration + Test.
7. **Release-Tag:** z. B. `v0.3.0` nach Phase 3.
8. **Übergabe-Notiz:** Was wurde gebaut, was ist offen, erster Schritt der nächsten Phase.
9. **Kurzes Review mit Luca:** Demo/Screenshots, Freigabe für die nächste Phase.

## Konventionen

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/de/) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:` …).
- **PRs:** ein PR pro Phase oder eine kleine Serie von PRs.
- **ADRs:** Architekturentscheidungen als ADR in `docs/adr/` festhalten (Vorlage: `docs/adr/0000-template.md`, fortlaufend nummeriert).
- **Changelog:** Jede nennenswerte Änderung bekommt einen Eintrag in `CHANGELOG.md` unter `[Unreleased]`.
- Formatierung macht Prettier (keine Semikolons, einfache Anführungszeichen, Zeilenbreite 100); nicht von Hand dagegen arbeiten.
