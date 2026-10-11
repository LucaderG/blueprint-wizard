# CLAUDE.md – Arbeitsregeln für KI-Coding-Tools

Kontext: Blueprint-Wizard ist eine lokale Web-App (SPA), die Nutzer zu einem Projekt-Blueprint führt. Ziele, Architektur und Phasen stehen im [Implementierungsplan](docs/implementierungsplan.md). Aktueller Stand: **Phase 0 – Fundament**.

## Stack

- Vite 8, React 19, TypeScript strict (inkl. `noUncheckedIndexedAccess`)
- Tailwind CSS v4, Komponenten im shadcn/ui-Stil in `src/shared/ui`, Icons von `lucide-react`
- React Router, i18next (Deutsch zuerst), Zustand für State (geplant)
- Vitest + Testing Library + MSW, Playwright für E2E
- ESLint + Prettier, Husky + lint-staged
- Geplant laut Plan: Zod (Validierung), Dexie/IndexedDB (Speicherung), OpenRouter (KI) – erst einführen, wenn die jeweilige Phase dran ist.
- Pfad-Alias: `@/` zeigt auf `src/`.

## Architekturregeln

- **`src/core/` kennt kein React.** Kein Import von `react`, `react-*`, `@/app/*` oder `@/features/*`. Das erzwingt ESLint (`no-restricted-imports` in `eslint.config.js`).
- **`src/features/<feature>/`**: ein Ordner pro Feature (Seiten, feature-eigene Komponenten und Hooks).
- **`src/shared/`**: wiederverwendbare UI-Komponenten (`ui/`), Utils (`lib/`), i18n (`i18n/`).
- **`src/app/`**: Routing, Layout, App-weite Provider.
- **Keine hart codierten UI-Texte.** Alle Texte als i18n-Keys in `src/shared/i18n/locales/de.json` und im Code über `t('...')`. Keys sind über `i18next.d.ts` typisiert.
- Typ-Importe mit `import type` (ESLint-Regel `consistent-type-imports`).

## Tests

- **Tests rufen nie echte APIs auf.** MSW läuft in jedem Test mit `onUnhandledRequest: 'error'` (`src/test/setup.ts`); nicht gemockte Requests lassen den Test fehlschlagen. Handler kommen in `src/test/msw/handlers.ts` oder per `server.use(...)` im Test.
- Unit- und Komponententests liegen neben dem Code als `*.test.ts` / `*.test.tsx`.
- E2E-Tests liegen in `e2e/` (Playwright, Chromium).
- Seiten testen mit `renderRoute('/pfad')` aus `src/test/render.tsx`.
- Neue Logik bekommt Tests. Abdeckung für `src/core/` ≥ 80 % (ab Phase 1).

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
