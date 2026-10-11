# ADR 0001: Tech-Stack

- **Status:** Angenommen
- **Datum:** 2026-10-11
- **Phase:** Phase 0

## Kontext

Blueprint-Wizard ist eine persönliche App, die Nutzer per KI zu einem Projekt-Blueprint führt. Anforderungen aus dem [Implementierungsplan](../implementierungsplan.md):

- Läuft ohne eigenes Backend und ohne Konto; Daten bleiben lokal.
- KI-Aufrufe über OpenRouter mit dem Key des Nutzers.
- Gut testbar (KI-Aufrufe deterministisch gemockt), wartbar und geeignet fürs Vibe-Coden.
- Deutsche Oberfläche zuerst, Englisch vorbereitet.

## Entscheidung

- **Plattform:** lokale Web-App (SPA), später optional als PWA installierbar.
- **Sprache und Build:** TypeScript (strict) mit Vite 8.
- **UI:** React 19, Tailwind CSS v4, Komponenten im shadcn/ui-Stil (liegen im Repo unter `src/shared/ui`), Icons von lucide-react.
- **Routing und State:** React Router; Zustand für State-Management.
- **i18n:** i18next mit `de` als Standardsprache.
- **Tests:** Vitest + Testing Library (Unit/Komponenten), MSW (Netzwerk-Mocks, nicht gemockte Requests schlagen fehl), Playwright (E2E).
- **Qualität:** ESLint (flat config, typescript-eslint, React-Hooks-Regeln) und Prettier; Husky + lint-staged vor jedem Commit; CI über GitHub Actions.
- **Architektur:** `src/core` bleibt frei von React (per ESLint erzwungen), Features in `src/features`, Gemeinsames in `src/shared`.
- **Kein eigener Server:** Der OpenRouter-Key bleibt lokal im Browser des Nutzers.
- **Geplant für spätere Phasen:** Zod (Validierung von KI-Antworten), Dexie/IndexedDB (lokale Speicherung), OpenRouter-Client hinter einer `AiProvider`-Schnittstelle.

## Konsequenzen

- Keine Server-Infrastruktur und keine Betriebskosten; Deployment als statische Seite möglich.
- Der API-Key liegt im Browser. Für eine persönliche App ist das vertretbar; er wird nur lokal gespeichert, nie geloggt und ist löschbar. Eine öffentliche Version mit fremdem Key bräuchte einen Proxy-Server (eigene Phase, nicht im Plan).
- Reine TypeScript-Logik in `src/core` ist ohne DOM testbar und austauschbar.
- shadcn/ui-Komponenten gehören dem Projekt: volle Anpassbarkeit, aber Updates werden manuell übernommen.
- UI-Texte müssen konsequent über i18n-Keys laufen.

## Erwogene Alternativen

- **Next.js:** Bringt Server-Rendering und Server-Funktionen, die ohne eigenes Backend keinen Nutzen haben, und erhöht Komplexität und Hosting-Anforderungen. Eine reine SPA mit Vite reicht und bleibt statisch deploybar.
- **oxlint statt ESLint:** Deutlich schneller, aber das Plugin-Ökosystem ist kleiner. ESLint wurde wegen der Plugins gewählt (typescript-eslint, React Hooks, React Refresh, Prettier-Kompatibilität) und weil sich Architekturregeln wie das React-Verbot in `src/core` über `no-restricted-imports` direkt abbilden lassen.
- **Desktop-App mit Tauri:** Vorerst nicht. Kann später (frühestens Phase 9) optional nachgerüstet werden, ohne Umbau, da die App ohnehin rein clientseitig läuft.
- **Eigener Backend-Server / Proxy:** Nicht nötig, solange jeder Nutzer seinen eigenen Key verwendet; der Key bleibt lokal.
