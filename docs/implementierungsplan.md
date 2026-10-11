# Implementierungsplan: Blueprint-Wizard

Arbeitstitel: **Blueprint-Wizard** – eine KI-gestützte App, die dich von jedem Ausgangspunkt (keine Idee, halbe Idee, fast fertige Idee) zu einem fertigen Projekt-Blueprint führt, mit dem du direkt mit dem Vibe-Coden anfangen kannst.

Stand: 11.10.2026 · Version 1 des Plans

> **Legende:** 🔶 = Entscheidung, die Luca bestätigen sollte. Ich habe überall einen Standard gewählt, damit die Arbeit nicht blockiert.

---

## 1. Ziel und Kernidee

Die App beantwortet drei Fragen:

1. **Wo stehe ich?** Sie erkennt, wie viel von der Idee schon da ist (leer, vage, entschieden) – pro Bereich des Blueprints.
2. **Was fehlt und was ist am wichtigsten?** Sie stellt gezielte Fragen und priorisiert sie nach _Hebelwirkung_: Entscheidungen, die das Projekt am stärksten verändern (z. B. „Web oder Mobile?“, „Mit Login oder ohne?“), kommen zuerst; Details zuletzt.
3. **Wie geht es weiter?** Am Ende steht ein Blueprint als Markdown plus vibe-coding-fertige Dateien (z. B. `CLAUDE.md` / `AGENTS.md`, Aufgabenliste, Prompt-Paket).

### Drei Einstiegspunkte, ein Ziel

| Einstieg                      | Was die App tut                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **„Ich habe keine Idee“**     | Fragt nach Interessen, Fähigkeiten, Zeit, Zielgruppe, Frust im Alltag; schlägt 3–5 Ideen vor; du wählst/kombinierst eine. |
| **„Ich habe eine Teil-Idee“** | Du beschreibst frei (Text). Die KI ordnet das den Blueprint-Bereichen zu und zeigt, was fehlt.                            |
| **„Ich habe fast alles“**     | Du fügst ein bestehendes Dokument ein. Die KI prüft Lücken, Widersprüche und Risiken und vertieft nur das Nötige.         |

Alle drei münden in denselben **Blueprint-Zustand** – dadurch gibt es nur _einen_ Kernablauf, der gepflegt werden muss.

---

## 2. Tech-Stack (Standard, mit Begründung)

| Bereich     | Wahl                                                                      | Warum                                                                                              |
| ----------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Sprache     | **TypeScript**                                                            | Typsicherheit über das ganze Datenmodell; gut wartbar; ideal fürs Vibe-Coden.                      |
| Frontend    | **React 19 + Vite**                                                       | Schnell, verbreitet, riesiges Ökosystem; kein Server nötig.                                        |
| UI          | **Tailwind CSS + shadcn/ui**                                              | Fertige, zugängliche Komponenten, die im Projekt liegen (anpassbar, kein Lock-in).                 |
| Zustand     | **Zustand**                                                               | Schlank, testbar, wenig Boilerplate.                                                               |
| Speicherung | **IndexedDB über Dexie**, lokal im Browser                                | Keine Datenbank, kein Konto; Projekte bleiben auf deinem Gerät. Export/Import als JSON.            |
| KI          | **OpenRouter**, direkt aus dem Browser (OpenAI-kompatible API)            | Ein Key, viele Modelle; OpenRouter erlaubt Browser-Aufrufe.                                        |
| Validierung | **Zod**                                                                   | KI-Antworten werden gegen Schemas geprüft (strukturierte JSON-Ausgaben), statt Freitext zu parsen. |
| Tests       | **Vitest**, **Testing Library**, **MSW** (KI-Mocks), **Playwright** (E2E) | Volle Testpyramide; KI-Aufrufe sind in Tests deterministisch gemockt.                              |
| Qualität    | ESLint, Prettier, `tsc --noEmit`, Husky + lint-staged                     | Fehler werden vor dem Commit gefangen.                                                             |
| CI          | **GitHub Actions**                                                        | Bei jedem Push: Lint, Typcheck, Tests, Build.                                                      |
| i18n        | **i18next**, Deutsch zuerst                                               | UI-Texte nicht hart codieren → Englisch später einfach.                                            |

🔶 **Entscheidung 1 – Plattform:** Standard ist eine **lokale Web-App (SPA)**, im Browser oder als installierbare PWA nutzbar. Alternative: Desktop-App via **Tauri** (kann ab Phase 9 nachgerüstet werden, ohne Umbau).

🔶 **Entscheidung 2 – Kein eigener Server:** Der OpenRouter-Key bleibt lokal im Browser des Nutzers. Das ist für eine persönliche App ideal. Soll die App später öffentlich mit _deinem_ Key laufen, braucht es einen kleinen Proxy-Server (eigene Phase, nicht im Plan).

🔶 **Entscheidung 3 – Sprache:** UI und KI-Ausgaben standardmäßig **Deutsch**, Englisch vorbereitet.

🔶 **Entscheidung 4 – Repository:** Es ist noch kein GitHub-Repo angehängt. Vorschlag: neues Repo `blueprint-wizard`. Sobald es existiert, kann ich Phase 0 umsetzen.

---

## 3. Architektur

```
src/
  app/            Routing, Layout, Provider
  features/
    settings/     API-Key, Modellwahl, Verbindungstest
    projects/     Projektliste, anlegen, löschen, Import/Export
    wizard/       Einstiegsauswahl, Fragen-Flow, Fortschritt
    blueprint/    Blueprint-Ansicht und -Bearbeitung
    export/       Markdown-, CLAUDE.md-, Task-Generatoren
  core/
    blueprint/    Datenmodell (Zod-Schemas), Vollständigkeit, Migrationen
    engine/       Lückenanalyse, Fragen-Priorisierung, Entscheidungslogik
    ai/           OpenRouter-Client, Prompt-Vorlagen, Antwort-Validierung
    storage/      Dexie-Datenbank, Repository-Schicht
  shared/         UI-Komponenten, Hooks, Utils, i18n
e2e/              Playwright
```

**Wichtige Prinzipien für Wartbarkeit:**

- **`core/` kennt kein React.** Engine, Datenmodell und KI-Client sind reine TypeScript-Module → einfach testbar, austauschbar.
- **KI hinter einer Schnittstelle** (`AiProvider`). OpenRouter ist eine Implementierung; ein Mock-Provider für Tests und eine Offline-Demo ist die zweite.
- **Prompts sind versionierte Dateien** (`core/ai/prompts/*.ts`) mit eigenen Tests, nicht verstreute Strings.
- **Datenmodell mit Schema-Version** und Migrationen, damit alte Projekte nach Updates weiter laden.

### Das Blueprint-Datenmodell (Herzstück)

Jeder Bereich hat Inhalt **und** einen Reifegrad:

```ts
type Reife = 'leer' | 'vage' | 'entschieden'

interface Abschnitt {
  id: AbschnittId // z. B. "zielgruppe"
  inhalt: string // Markdown
  reife: Reife
  entscheidungen: Entscheidung[]
  offeneFragen: Frage[]
  quelle: 'nutzer' | 'ki-vorschlag' | 'ki-uebernommen'
}
```

Blueprint-Bereiche (Version 1):

1. Problem & Vision
2. Zielgruppe & Nutzer
3. Kernfunktionen (MVP)
4. Nicht-Ziele (bewusst ausgelassen)
5. Nutzerabläufe / Screens
6. Datenmodell
7. Tech-Stack & Plattform
8. Integrationen & externe Dienste
9. Risiken & offene Punkte
10. Umsetzungs-Roadmap (Phasen/Meilensteine)

**Entscheidung** = Frage + Optionen + Konsequenzen + gewählte Option + Begründung + _Hebel_ (1–5). Daraus entsteht die Priorisierung.

### Der Fragenmotor (Engine)

Ein Durchlauf („Runde“):

1. **Analyse:** KI erhält den aktuellen Blueprint (JSON) und liefert strukturiert: Reife pro Abschnitt, Lücken, Widersprüche.
2. **Kandidaten:** KI schlägt Fragen und Entscheidungen vor, jeweils mit Hebel (Auswirkung), Abhängigkeiten und 2–4 Antwortoptionen inkl. Konsequenz.
3. **Priorisierung (deterministisch im Code):** `Score = Hebel × Unsicherheit × Abhängigkeitsfaktor`. Grundsatzentscheidungen vor Details; Fragen, deren Voraussetzung fehlt, werden zurückgestellt.
4. **Präsentation:** 1–3 Fragen auf einmal, je mit „Vorschlag übernehmen“, eigener Antwort oder „Später“.
5. **Einarbeiten:** Antwort aktualisiert Abschnitt(e) und Reife; Fortschrittsanzeige steigt.

Die Priorisierung bewusst im Code (nicht nur in der KI) hält das Verhalten nachvollziehbar und testbar.

---

## 4. Phasen

Jede Phase endet mit einem **Phasen-Übergang** (siehe Abschnitt 5). Erst wenn er bestanden ist, beginnt die nächste Phase. Jede Phase ist ein eigener Branch/PR (oder eine kleine Serie davon) und liefert etwas Lauffähiges.

### Phase 0 – Fundament

**Ziel:** Ein leeres, aber produktionsreifes Projektgerüst.

- Vite + React + TypeScript (strict) aufsetzen, Ordnerstruktur wie oben
- Tailwind, shadcn/ui, i18next (de), Router
- ESLint, Prettier, Husky, lint-staged
- Vitest + Testing Library, Playwright, MSW einrichten
- GitHub Actions: Lint → Typcheck → Unit-Tests → Build → E2E
- `README.md`, `CLAUDE.md` (Arbeitsregeln fürs Vibe-Coden), `CHANGELOG.md`, `docs/adr/` für Architekturentscheidungen

**Tests:** Ein Smoke-Unit-Test und ein E2E-Test „App startet und zeigt Startseite“.
**Abnahme:** CI grün, `npm run dev` zeigt eine Startseite.

### Phase 1 – Datenmodell & Speicherung

**Ziel:** Projekte und Blueprints lassen sich anlegen, speichern, laden.

- Zod-Schemas für Blueprint, Abschnitt, Entscheidung, Frage (mit `schemaVersion`)
- Vollständigkeits-Berechnung (gewichteter Score pro Abschnitt und gesamt)
- Dexie-Datenbank, Repository-Schicht (`ProjektRepository`)
- Migrationssystem (auch wenn es erst Version 1 gibt)
- Projektliste: anlegen, umbenennen, löschen, duplizieren
- JSON-Export/-Import eines Projekts

**Tests:** Schema-Validierung (gültig/ungültig), Vollständigkeits-Score, Repository mit `fake-indexeddb`, Migration v1→v1-Dummy, Import/Export-Roundtrip.
**Abnahme:** Projekt anlegen → Seite neu laden → Projekt ist noch da.

### Phase 2 – Einstellungen & OpenRouter-Anbindung

**Ziel:** Der Nutzer hinterlegt seinen Key und die App kann mit der KI reden.

- Einstellungsseite mit:
  - Feld für den **OpenRouter-API-Key** (maskiert, ein-/ausblendbar)
  - **Link „API-Key bei OpenRouter erstellen“** → `https://openrouter.ai/keys`
  - Modellauswahl (Liste per OpenRouter-Modell-API, mit sinnvollem Standard)
  - Button **„Verbindung testen“**
  - Optional: Temperatur, Ausgabesprache
- `AiProvider`-Schnittstelle, `OpenRouterProvider`, `MockProvider`
- Strukturierte Ausgaben: JSON-Modus + Zod-Validierung + 1 automatischer Reparaturversuch bei ungültiger Antwort
- Fehlerbehandlung: ungültiger Key, Rate-Limit, kein Guthaben, Netzwerkfehler, Timeout – jeweils mit verständlicher Meldung
- Streaming für längere Texte
- Hinweis zur Speicherung: Key liegt nur lokal im Browser; Button „Key löschen“

🔶 **Entscheidung 5 – Standardmodell:** Vorschlag: ein starkes, preiswertes Allround-Modell als Standard, frei umstellbar. Die konkrete Modell-ID wird in Phase 2 anhand der aktuellen OpenRouter-Liste festgelegt.

**Tests:** OpenRouter-Client gegen MSW-Mocks (Erfolg, 401, 402, 429, kaputtes JSON, Timeout); Einstellungsformular; E2E „Key eintragen → Test erfolgreich“ (gemockt).
**Abnahme:** Mit echtem Key liefert „Verbindung testen“ eine Antwort; ohne Key führt die App freundlich zur Einstellungsseite.

### Phase 3 – Wizard-Gerüst & Einstiegspunkte

**Ziel:** Der Ablauf steht, zunächst ohne „intelligente“ Fragen.

- Startbildschirm: drei Einstiege (keine Idee / Teil-Idee / fast fertig)
- Freitext-/Dokument-Eingabe für „Teil-Idee“ und „fast fertig“
- **Einordnung per KI:** Text → Abschnitte + Reife (strukturierte Ausgabe)
- Blueprint-Übersicht: Karten pro Abschnitt mit Reife-Ampel, manuell bearbeitbar
- Fortschrittsanzeige (Vollständigkeits-Score)
- Autosave, Rückgängig (letzte Änderungen)

**Tests:** Einordnungs-Prompt mit festen Beispieltexten (Mock-Antworten), Komponenten-Tests der Übersicht, E2E „Teil-Idee eingeben → Abschnitte gefüllt“.
**Abnahme:** Eine eingefügte Idee erscheint sinnvoll verteilt auf die Abschnitte.

### Phase 4 – Intelligenter Fragenmotor

**Ziel:** Die App stellt die _richtigen_ Fragen in der _richtigen_ Reihenfolge.

- Lückenanalyse-Prompt (Lücken, Widersprüche, Reife)
- Fragen-Kandidaten mit Hebel, Abhängigkeiten, Optionen
- Priorisierungsalgorithmus in `core/engine` (deterministisch)
- Fragen-UI: 1–3 Fragen pro Runde, Antwort per Option, Freitext oder „Später“
- Antworten werden in Abschnitte eingearbeitet (KI formuliert, Nutzer bestätigt)
- Verlauf: welche Frage wann wie beantwortet wurde

**Tests:** Priorisierung mit Tabellen-Tests (gegebene Kandidaten → erwartete Reihenfolge), Abhängigkeitslogik, Einarbeitung ohne Datenverlust, **Prompt-Regressionstests** mit gespeicherten Beispiel-Blueprints („Golden Files“).
**Abnahme:** Bei einem vagen Blueprint kommen zuerst Grundsatzfragen (Plattform, Zielgruppe, MVP-Umfang), keine Detailfragen.

### Phase 5 – Entscheidungen & Vorschläge

**Ziel:** Die App sagt, _welche Entscheidungen den größten Unterschied machen_, und macht Vorschläge.

- Ansicht **„Wichtigste Entscheidungen“**: sortiert nach Hebel, je mit Optionen, Vor-/Nachteilen und Konsequenzen
- **Vorschlagsmodus:** KI schlägt sinnvolle Ergänzungen vor (Features, Nicht-Ziele, Risiken), einzeln annehmen/ablehnen
- Widerspruchs-Warnungen (z. B. „offline-first“ vs. „Echtzeit-Kollaboration“)
- Entscheidungsprotokoll mit Begründung (wird Teil des Blueprints)

**Tests:** Entscheidungs-Schema, Annehmen/Ablehnen ändert Zustand korrekt, Widerspruchserkennung mit Beispielfällen, E2E „Vorschlag annehmen → erscheint im Blueprint“.
**Abnahme:** Für eine Beispielidee werden 3–7 Kernentscheidungen sinnvoll priorisiert angezeigt.

### Phase 6 – Ideenfindung von Null

**Ziel:** Auch ohne jede Idee kommt man ans Ziel.

- Kurzer Fragebogen: Interessen, Fähigkeiten, verfügbare Zeit, Lernziel, Frust im Alltag, gewünschte Plattform
- KI generiert 3–5 Ideen mit Kurzbeschreibung, Aufwand, Neuheit, Lernwert
- Ideen kombinieren, verfeinern („mehr wie X“, „einfacher“), neu würfeln
- Gewählte Idee wird als Startzustand in den normalen Wizard übergeben

**Tests:** Fragebogen-Logik, Ideen-Schema, Übergabe an Wizard, E2E „keine Idee → Idee gewählt → Wizard startet“.
**Abnahme:** Ohne Vorwissen entsteht in wenigen Minuten ein gefüllter Start-Blueprint.

### Phase 7 – Blueprint-Generierung & Export

**Ziel:** Das Ergebnis ist direkt fürs Vibe-Coden nutzbar.

- „Blueprint fertigstellen“: Reife-Check, Hinweis auf offene Punkte (fertigstellen trotzdem möglich)
- Exporte:
  - `BLUEPRINT.md` (vollständiges Dokument)
  - `CLAUDE.md` / `AGENTS.md` (Kontext + Regeln für KI-Coding-Tools)
  - `TASKS.md` (Umsetzungsschritte nach Phasen, mit Abnahmekriterien)
  - **Start-Prompt** zum Kopieren für Claude Code, Cursor o. ä.
  - ZIP mit allem
- Vorschau aller Dateien vor dem Download

**Tests:** Generatoren als reine Funktionen (Snapshot-Tests), Vollständigkeit der Exporte, ZIP-Inhalt, E2E „Blueprint exportieren“.
**Abnahme:** Ein exportiertes Paket in ein leeres Repo legen und ein KI-Coding-Tool damit starten können.

### Phase 8 – Qualität & Politur

**Ziel:** Robust, angenehm, zugänglich.

- Leere Zustände, Ladezustände, Fehlerzustände durchgehend
- Barrierefreiheit (Tastatur, Kontraste, ARIA), Prüfung mit axe
- Dark Mode, responsives Layout
- Kostenanzeige: Tokens/geschätzte Kosten pro Runde (aus OpenRouter-Antwort)
- Englische Übersetzung
- PWA (offline öffnen, installierbar)
- Performance-Check (Bundle-Größe, Lazy Loading)

**Tests:** axe-Checks in E2E, visuelle Prüfung wichtiger Screens, Lighthouse-Lauf in CI.
**Abnahme:** Keine kritischen a11y-Befunde, Lighthouse ≥ 90 in allen Kategorien.

### Phase 9 – Release & Wartung

**Ziel:** Version 1.0 veröffentlicht und dauerhaft pflegbar.

- Deployment (z. B. GitHub Pages, Netlify oder Vercel – rein statisch)
- Semantische Versionierung, `CHANGELOG.md`, Release-Workflow
- Renovate/Dependabot für Abhängigkeits-Updates
- Dokumentation: Nutzerhandbuch, Architektur-Überblick, „So fügst du einen neuen Blueprint-Abschnitt hinzu“
- Optional: Tauri-Desktop-Build

🔶 **Entscheidung 6 – Hosting:** Vorschlag GitHub Pages (kostenlos, passt zum Repo).

**Abnahme:** Öffentliche URL, v1.0.0 getaggt, Update-Prozess dokumentiert.

### Spätere Ideen (bewusst nicht in v1)

Mehrere Blueprints vergleichen, Vorlagen pro Projekttyp (SaaS, Game, CLI …), Zusammenarbeit/Teilen, Sync über Geräte, direkter Repo-Anstoß via GitHub.

---

## 5. Phasen-Übergang (gilt für jede Phase)

Am Ende jeder Phase wird diese Checkliste abgearbeitet:

1. **Tests:** Alle Unit-, Integrations- und E2E-Tests grün; neue Logik hat Tests. Abdeckung für `core/` ≥ 80 %.
2. **Qualität:** Lint, Typcheck und Build ohne Fehler/Warnungen; CI grün.
3. **Manueller Test:** Die Abnahmekriterien der Phase einmal von Hand durchspielen (bei KI-Features mit echtem Key).
4. **Refactoring-Fenster:** Kurzer Aufräum-Durchgang – Duplikate, Namen, tote Pfade.
5. **Dokumentation:** README/`CLAUDE.md` aktualisiert, Architekturentscheidungen als ADR festgehalten, `CHANGELOG.md`-Eintrag.
6. **Datenkompatibilität:** Lädt ein Projekt aus der Vorphase noch? Falls das Schema geändert wurde: Migration + Test.
7. **Release-Tag:** z. B. `v0.3.0` nach Phase 3, damit man jederzeit zurückspringen kann.
8. **Übergabe-Notiz:** Was wurde gebaut, was ist offen, was ist der erste Schritt der nächsten Phase.
9. **Kurzes Review mit Luca:** Demo/Screenshots, Freigabe für die nächste Phase.

---

## 6. Teststrategie im Überblick

| Ebene             | Werkzeug                      | Was                                                                                          |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| Unit              | Vitest                        | Schemas, Score, Priorisierung, Generatoren, Migrationen                                      |
| Integration       | Vitest + MSW + fake-indexeddb | KI-Client, Repository, Engine-Durchlauf mit Mock-KI                                          |
| Komponenten       | Testing Library               | Formulare, Wizard-Schritte, Blueprint-Karten                                                 |
| E2E               | Playwright                    | Komplette Abläufe aller drei Einstiege, mit gemockter KI                                     |
| Prompt-Regression | Vitest + Golden Files         | Gespeicherte Beispiel-Eingaben; optionaler Live-Lauf gegen OpenRouter (manuell, nicht in CI) |
| Qualität          | axe, Lighthouse               | Barrierefreiheit, Performance                                                                |

Grundsatz: **CI ruft nie die echte KI auf** (kostenlos, deterministisch). Echte KI-Läufe sind ein manueller Schritt im Phasen-Übergang.

---

## 7. Risiken und Gegenmaßnahmen

| Risiko                                       | Gegenmaßnahme                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| KI liefert ungültiges oder schwankendes JSON | Zod-Validierung, Reparaturversuch, Modelle mit JSON-Modus bevorzugen                         |
| Fragen werden beliebig/redundant             | Deterministische Priorisierung im Code, Verlauf verhindert Wiederholungen, Golden-File-Tests |
| Kosten laufen aus dem Ruder                  | Kostenanzeige, kompakter Kontext (nur relevante Abschnitte senden), Modellwahl               |
| API-Key im Browser                           | Nur lokal gespeichert, nie geloggt, klarer Hinweis, „Key löschen“                            |
| Schema-Änderungen brechen alte Projekte      | `schemaVersion` + Migrationen + Tests ab Phase 1                                             |
| Scope-Creep in der App selbst                | „Spätere Ideen“-Liste, jede Phase hat feste Abnahmekriterien                                 |

---

## 8. Offene Entscheidungen für Luca (Zusammenfassung)

| #   | Frage           | Mein Standard                                          |
| --- | --------------- | ------------------------------------------------------ |
| 1   | Plattform       | Lokale Web-App/PWA, Desktop (Tauri) optional später    |
| 2   | Eigener Server? | Nein, Key bleibt lokal                                 |
| 3   | Sprache         | Deutsch zuerst, Englisch vorbereitet                   |
| 4   | Repository      | Neues GitHub-Repo `blueprint-wizard`                   |
| 5   | Standardmodell  | Wird in Phase 2 aus aktueller OpenRouter-Liste gewählt |
| 6   | Hosting         | GitHub Pages                                           |

**Nächster Schritt:** Repo anlegen bzw. verbinden und Phase 0 starten.
