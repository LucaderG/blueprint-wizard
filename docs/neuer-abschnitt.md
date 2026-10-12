# So fügst du einen neuen Blueprint-Abschnitt hinzu

Ein Blueprint-Abschnitt ist ein fester Eintrag in `SECTION_IDS` (`src/core/blueprint/sections.ts`). Ein neuer Abschnitt ändert das gespeicherte Projektformat: Das Zod-Schema verlangt in jedem Projekt alle Abschnitte. Deshalb braucht der neue Abschnitt eine höhere Schemaversion und eine Migration. Ohne Migration lehnt die App alle bestehenden Projekte ab.

Im Beispiel heißt der Abschnitt `privacy` („Datenschutz & Sicherheit“). Die Kennung `risks` gibt es bereits („Risiken & offene Punkte“), deshalb wählen wir hier eine andere.

Die Schritte wurden an einer Kopie des Repos mit diesem Beispiel durchgespielt. Typecheck und Tests zeigten genau die Stellen, die in der Übersicht unten stehen. Der übrige Code folgt dem Abschnittskatalog automatisch.

## Übersicht: alle Stellen

Legende: **TS** heißt, dass TypeScript fehlende Einträge meldet (Record-Typen, typisierte i18n-Keys). **Auto** heißt, dass der Code über `SECTION_IDS` iteriert und keine Änderung braucht. **Manuell** heißt, dass eine feste Liste oder ein Wert bewusst entschieden werden muss.

| #   | Datei                                                                                      | Was zu tun ist                                                    | Art                                                       |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | `src/core/blueprint/sections.ts`                                                           | `SECTION_IDS` erweitern, `SECTION_WEIGHTS` ergänzen               | TS (fehlendes Gewicht)                                    |
| 2   | `src/core/blueprint/schema.ts`                                                             | `CURRENT_SCHEMA_VERSION` erhöhen                                  | Manuell                                                   |
| 3   | `src/core/blueprint/migrations.ts`                                                         | Migration `3: migrateV3ToV4` ergänzen                             | Pflicht, ohne TS-Hinweis                                  |
| 4   | `src/core/blueprint/__fixtures__/`                                                         | echte v3-Daten als `project-v3.json`                              | Pflicht                                                   |
| 5   | `src/core/blueprint/migrations.test.ts`                                                    | Migrationstest ergänzen, bestehende Schleifen anpassen            | Manuell                                                   |
| 6   | `src/shared/i18n/locales/de.json` und `en.json`                                            | `sections.<id>` in beiden Sprachen                                | TS (typisierte Keys)                                      |
| 7   | `src/core/ai/prompts/classifyIdea.ts`                                                      | Eintrag in `SECTION_GUIDE`                                        | TS (Record)                                               |
| 8   | Prompt-Dateien und Golden Files                                                            | `*_PROMPT_VERSION` erhöhen, Golden Files neu erzeugen             | Manuell                                                   |
| 9   | `src/core/engine/prioritization.ts`                                                        | Eintrag in `SECTION_PREREQUISITES`, ggf. `FOUNDATION_SECTIONS`    | TS (Record)                                               |
| 10  | `src/core/export/generators.ts`                                                            | feste Listen in `generateAgentContext` und `generateTasks`        | Manuell                                                   |
| 11  | `src/core/export/testing.ts`                                                               | Eintrag in `contents` an der Stelle von `SECTION_IDS`             | Manuell (kein TS-Hinweis)                                 |
| 12  | Export-Snapshots                                                                           | `__snapshots__/generators.test.ts.snap` neu erzeugen, Diff prüfen | Manuell                                                   |
| 13  | `src/core/export/readiness.test.ts`                                                        | fester Wert `toHaveLength(10)`                                    | Manuell                                                   |
| 14  | `src/core/blueprint/completeness.test.ts`                                                  | feste Gesamtsumme (Gewichte)                                      | Manuell                                                   |
| 15  | `src/features/projects/ProjectPage.test.tsx`                                               | `SECTION_NAMES` und feste Zählwerte                               | Manuell                                                   |
| 16  | `e2e/projects.spec.ts` (Zeile 28)                                                          | `toHaveCount(10)` auf die neue Anzahl setzen                      | Manuell                                                   |
| 17  | `README.md` (Zeile 18), `docs/benutzerhandbuch.md` (Zeilen 21, 114, 138, 310)              | Text „zehn“ anpassen                                              | Manuell                                                   |
| 18  | `CHANGELOG.md`                                                                             | Eintrag unter `[Unreleased]`                                      | Pflicht                                                   |
| 19  | `src/core/blueprint/factory.ts`, `testing.ts`, `schema.ts` (`sectionsShape`), `editing.ts` | keine Änderung                                                    | Auto                                                      |
| 20  | `src/core/export/readiness.ts`                                                             | keine Änderung                                                    | Auto                                                      |
| 21  | `src/core/engine/contradictions.ts`, `interview.ts`, `decisions.ts`, `classification.ts`   | keine Änderung                                                    | Auto (KI-Schemas nutzen `sectionIdSchema`)                |
| 22  | `src/features/blueprint/*`, Fragen- und Entscheidungsansichten                             | keine Änderung                                                    | Auto (`t('sections.<id>')`, Iteration über `SECTION_IDS`) |
| 23  | `src/core/engine/ideation.ts` (`applyChosenIdea`)                                          | nur, wenn Ideen den Abschnitt füllen sollen                       | Optional                                                  |
| 24  | `src/core/ai/prompts/suggestAdditions.ts`, `schema.ts` (`ADDITION_SECTION_IDS`)            | nur, wenn der Abschnitt Vorschläge bekommen soll                  | Optional                                                  |

Die ADRs unter `docs/adr/` bleiben unverändert; sie sind Entscheidungsgeschichte.

## Schritt für Schritt

### Schritt 0: Entscheidungen vorab klären

1. **Gewicht:** Grundsatzthemen wie Problem oder Kernfunktionen wiegen 3 und zählen beim Vollständigkeits-Score am stärksten. Details wiegen 1.
2. **Position:** `SECTION_IDS` ist die Anzeigereihenfolge. Die Position dient zudem als Sortierung bei gleicher Rangfolge von Fragen und Entscheidungen.
3. **Voraussetzungen:** Welche Abschnitte müssen gefüllt sein, bevor der Fragenmotor Fragen zum neuen Abschnitt stellt (`SECTION_PREREQUISITES`)?
4. **Vorschläge:** Soll die KI Ergänzungen für den Abschnitt vorschlagen? Das ist nur für `features`, `nonGoals` und `risks` vorgesehen (`ADDITION_SECTION_IDS`).
5. **Export:** Soll der Abschnitt in `CLAUDE.md`, `AGENTS.md` oder `TASKS.md` auftauchen? `BLUEPRINT.md` nimmt ihn in jedem Fall auf.

### Schritt 1: Abschnitt registrieren

In `src/core/blueprint/sections.ts`:

```ts
export const SECTION_IDS = [
  'problem',
  // …
  'risks',
  'privacy',
  'roadmap',
] as const

export const SECTION_WEIGHTS: Record<SectionId, number> = {
  // …
  risks: 1,
  privacy: 1,
  roadmap: 1,
}
```

Fehlt ein Eintrag in einer Map vom Typ `Record<SectionId, …>`, meldet TypeScript die Stelle. Die Meldungen zeigen die Stellen aus den Schritten 5 bis 7.

### Schritt 2: Schemaversion erhöhen

In `src/core/blueprint/schema.ts`:

```ts
export const CURRENT_SCHEMA_VERSION = 4
```

Das Schema prüft `schemaVersion` mit `z.literal(CURRENT_SCHEMA_VERSION)`. Alle übrigen Schemateile übernehmen den neuen Abschnitt automatisch.

### Schritt 3: Migration schreiben

In `src/core/blueprint/migrations.ts` die Migration ergänzen. Die bestehenden Migrationen verschieben nur Felder und ergänzen keine Abschnitte. Diese ist die erste, die einen Abschnitt hinzufügt:

```ts
export const PROJECT_MIGRATIONS: MigrationMap = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
}

/** v3 → v4: der Abschnitt „privacy“ kommt hinzu; ältere Projekte bekommen ihn leer. */
function migrateV3ToV4(data: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(data.blueprint) || !isRecord(data.blueprint.sections)) {
    return { ...data, schemaVersion: 4 }
  }
  const sections = {
    ...data.blueprint.sections,
    privacy: data.blueprint.sections.privacy ?? {
      id: 'privacy',
      content: '',
      maturity: 'empty',
      source: 'user',
    },
  }
  return { ...data, schemaVersion: 4, blueprint: { ...data.blueprint, sections } }
}
```

Ohne die Migration bricht `runMigrations` für v3-Projekte mit `unsupportedVersion` ab („Keine Migration von Version 3 vorhanden“). Eine Migration, die den Abschnitt nicht ergänzt, scheitert an der Zod-Prüfung mit `invalidFormat`. Die Meldung nennt dann den fehlenden Pfad. Im Experiment mit einem Testabschnitt `glossary` lautete sie `expected object, received undefined` für `blueprint.sections.glossary`.

### Schritt 4: Echte Altdaten als Fixture und Tests

1. Eine JSON-Sicherung aus der laufenden Version-3-App erstellen (Projektliste, Export). Aus der Datei das Feld `project` nehmen und als `src/core/blueprint/__fixtures__/project-v3.json` speichern. Die Hülle `{ format, exportedAt, project }` gehört nicht in die Fixture (ADR 0002).
2. In `src/core/blueprint/migrations.test.ts` einen Testblock für v3 zu v4 ergänzen. Beispiel:

   ```ts
   describe('Migration v3 → v4', () => {
     it('ergänzt den neuen Abschnitt leer', () => {
       const project = migrateProject(JSON.parse(JSON.stringify(projectV3)))

       expect(project.blueprint.sections.privacy).toEqual({
         id: 'privacy',
         content: '',
         maturity: 'empty',
         source: 'user',
       })
     })
   })
   ```

3. Die bestehenden Tests anpassen. Die Schleifen `for (const id of SECTION_IDS)` in den Tests zu v1 zu v2 und v2 zu v3 lesen Altdaten über `projectV1.blueprint.sections[id]` bzw. `projectV2…`. Für `privacy` gibt es dort keine Altdaten; der Zugriff schlägt fehl (`Cannot read properties of undefined`), und TypeScript meldet den Index. Hier hilft, nur die Abschnitte der jeweiligen Fixture zu durchlaufen (`Object.keys(projectV1.blueprint.sections)`).
4. Der Test „kennt die Fixture-Abschnitte als Abschnittskatalog“ prüft Gleichheit mit `SECTION_IDS` und schlägt fehl, sobald ein Abschnitt dazukommt. Er ist so umzuformulieren, dass die Fixture eine Teilmenge des Katalogs ist.

### Schritt 5: Texte in beiden Sprachen

In `src/shared/i18n/locales/de.json` und `en.json` jeweils unter `sections` den Schlüssel ergänzen:

```json
"sections": {
  "risks": "Risiken & offene Punkte",
  "privacy": "Datenschutz & Sicherheit",
  "roadmap": "Umsetzungs-Roadmap"
}
```

Englisch: `"privacy": "Privacy & security"`. Die Reihenfolge der Schlüssel in der JSON-Datei ist für die Anzeige ohne Bedeutung; die Anzeigereihenfolge kommt aus `SECTION_IDS`. `locales.test.ts` prüft, dass beide Dateien dieselben Schlüssel haben. Fehlt der Schlüssel in `de.json`, meldet TypeScript die typisierten `t()`-Aufrufe.

### Schritt 6: KI-Prompts

In `src/core/ai/prompts/classifyIdea.ts` die Anleitung ergänzen. Diese Map (`SECTION_GUIDE`) nutzen auch `analyzeBlueprint.ts`, `identifyDecisions.ts` und `integrateAnswers.ts`:

```ts
export const SECTION_GUIDE: Record<SectionId, string> = {
  // …
  privacy:
    'Datenschutz & Sicherheit: Welche personenbezogenen Daten anfallen und wie sie geschützt werden.',
}
```

Die Versionen erhöhen, denn nach CLAUDE.md zählt jede inhaltliche Änderung eines Prompts:

- `CLASSIFY_IDEA_PROMPT_VERSION` in `classifyIdea.ts`
- `ANALYZE_BLUEPRINT_PROMPT_VERSION` in `analyzeBlueprint.ts`
- `IDENTIFY_DECISIONS_PROMPT_VERSION` in `identifyDecisions.ts`

Diese drei Prompts listen alle Abschnitte im System-Prompt. `integrate-answers` nennt nur die betroffenen Abschnitte; sein Text ändert sich erst, wenn der neue Abschnitt dort vorkommt. Im Zweifel die Version auch dort erhöhen.

Danach die Golden Files neu erzeugen. Der Pfad steht vor dem Flag:

```bash
npx vitest run src/core/ai/prompts -u
git diff -- src/core/ai/prompts/__golden__
```

Hinweis: Den Pfad vor `-u` nennen. Steht `-u` vorn (`npx vitest run -u src/core/ai/prompts`), läuft in dieser Vitest-Version die ganze Suite und schreibt Snapshots aller Bereiche neu. Die Diffs prüfen. Erwartet sind vor allem neue Abschnittszeilen wie `## privacy [empty]`. `classify-idea` hat keine Golden Files; dort prüft `classifyIdea.test.ts`, dass alle Abschnitte im System-Prompt stehen.

Soll der Abschnitt Vorschläge bekommen (Schritt 0, Punkt 4), zusätzlich `ADDITION_SECTION_IDS` in `schema.ts` erweitern. Die Liste im Text von `suggestAdditions.ts` ist fest und muss angepasst werden; danach Version und Golden Files wie oben.

### Schritt 7: Priorisierung

In `src/core/engine/prioritization.ts`:

```ts
export const SECTION_PREREQUISITES: Record<SectionId, readonly SectionId[]> = {
  // …
  privacy: ['features'],
}
```

`FOUNDATION_SECTIONS` (aktuell `problem`, `audience`, `features`) nur erweitern, wenn der neue Abschnitt ähnlich zentral ist. Dann warten Detailfragen auch auf ihn. Der System-Prompt von `analyzeBlueprint.ts` nennt dieselbe Liste im Text und muss dann mit angepasst werden. Die Reihenfolge der Fragen sortiert der Kern nach `SECTION_IDS`; dafür ist nichts zu tun.

Einen Testfall in `prioritization.test.ts` ergänzen, der eine Frage zum neuen Abschnitt bei fehlender Voraussetzung als „section“ blockiert.

### Schritt 8: Export

1. **BLUEPRINT.md** nimmt den Abschnitt automatisch auf, weil `generateBlueprint` über `SECTION_IDS` iteriert. Der Reife-Check (`readiness.ts`) zählt ihn ebenfalls automatisch mit.
2. **CLAUDE.md und AGENTS.md** (`generateAgentContext`) listen fest `problem`, `audience`, `features`, `nonGoals` und `techStack`. **TASKS.md** (`generateTasks`) listet fest `roadmap`, `features`, `flows` und `nonGoals`. Hier entscheiden: Gehört der neue Abschnitt in die Kontextdateien oder in die Aufgaben? Dann die Liste erweitern. Sonst bleibt er nur in `BLUEPRINT.md`.
3. In `src/core/export/testing.ts` gibt es die Liste `contents`, die parallel zu `SECTION_IDS` läuft. Ein neuer Eintrag muss an der passenden Stelle stehen. Fehlt er, ist der Inhalt des Abschnitts `undefined`, und TypeScript warnt hier nicht.
4. Snapshots neu erzeugen und prüfen:

   ```bash
   npx vitest run src/core/export -u
   git diff -- src/core/export/__snapshots__
   ```

   Erwartet sind neue Zeilen für den Abschnitt, etwa `_Reifegrad: leer_`, und keine Änderungen an fremden Stellen.

5. `EXPORT_VERSION` (in `generators.ts`, aktuell 1) beschreibt das Dateiformat, nicht den Abschnittsbestand (ADR 0008). Der neue Abschnitt ändert das Format nicht. Ob die Version trotzdem steigt, ist eine Teamentscheidung und keine technische Pflicht. Im Experiment blieb sie bei 1.

### Schritt 9: Feste Testwerte anpassen

Diese Tests enthalten feste Werte und schlagen nach dem Hinzufügen fehl. Im Experiment schlugen genau diese fehl; dazu kamen Migrationstests, Golden Files und Snapshots aus den Schritten 4, 6 und 8.

- `src/core/blueprint/completeness.test.ts`: Die Erwartungen (`toBe(18)`, `toBe(6)`) und der Kommentar zum Gesamtgewicht 17 sind fest. Neue Werte berechnen.
- `src/core/export/readiness.test.ts`: `toHaveLength(10)` auf die neue Anzahl setzen.
- `src/features/projects/ProjectPage.test.tsx`: `SECTION_NAMES` um den neuen Namen ergänzen (Zeile 9; daran hängt der Test in Zeile 79). Der feste Zählwert in Zeile 177 passt ebenfalls nicht mehr.
- `e2e/projects.spec.ts` (Zeile 28): `toHaveCount(10)` auf die neue Anzahl setzen.

### Schritt 10: Texte mit „zehn“

„Zehn Abschnitte“ steht in `README.md` (Zeile 18) und in `docs/benutzerhandbuch.md` (Zeilen 21, 114, 138 und 310). Diese Stellen auf die neue Anzahl bringen oder umformulieren. Unter „Die zehn Abschnitte“ (ab Zeile 138) zusätzlich den neuen Abschnitt in die nummerierte Liste aufnehmen. Die ADRs bleiben unverändert.

### Schritt 11: Prüfen

1. `npm run check`: Lint, Formatprüfung, Typecheck, Tests mit Abdeckung. Die Abdeckung in `core/` muss mindestens 80 % erreichen.
2. `npm run test:e2e`: baut die App und prüft die E2E-Szenarien.
3. Manuell, am besten mit echtem Key: eine v3-Sicherung importieren (Projektliste, Import). Das Projekt muss laden und den neuen Abschnitt leer anzeigen. Ein neues Projekt anlegen, Blueprint fertigstellen und die Dateien prüfen.

### Schritt 12: Dokumentation

1. `CHANGELOG.md` unter `[Unreleased]`: einen Eintrag unter „Hinzugefügt“ für den neuen Abschnitt und einen unter „Geändert“ für das Schema (Version 4, bestehende Projekte bekommen den leeren Abschnitt).
2. ADR: Ein Abschnitt allein braucht keinen ADR. ADR 0002 beschreibt den Ablauf bereits. Einen neuen ADR gibt es nur, wenn die Entscheidung über den Abschnitt hinaus architektonisch ist, etwa eine neue Art von Abschnitt mit eigener Logik. Dann nach `docs/adr/0000-template.md` anlegen.
3. CLAUDE.md nur ändern, wenn sich Arbeitsregeln ändern, nicht für einen einzelnen Abschnitt.

## Checkliste

- [ ] Gewicht, Position und Voraussetzungen festgelegt (Schritt 0)
- [ ] `SECTION_IDS` und `SECTION_WEIGHTS` ergänzt (`sections.ts`)
- [ ] `CURRENT_SCHEMA_VERSION` erhöht, Migration registriert (`schema.ts`, `migrations.ts`)
- [ ] Fixture `project-v3.json` mit echten Altdaten, Migrationstests angepasst und ergänzt
- [ ] `sections.<id>` in `de.json` und `en.json`
- [ ] `SECTION_GUIDE`, Prompt-Versionen und Golden Files aktualisiert
- [ ] `SECTION_PREREQUISITES` ergänzt, ggf. `FOUNDATION_SECTIONS`
- [ ] Export: feste Listen entschieden, `export/testing.ts` ergänzt, Snapshots geprüft
- [ ] Feste Testwerte angepasst (`completeness`, `readiness`, `ProjectPage`, `projects.spec.ts`)
- [ ] „Zehn“-Texte in README und Benutzerhandbuch angepasst
- [ ] `npm run check` grün
- [ ] `npm run test:e2e` grün
- [ ] Manueller Test: v3-Sicherung laden, neuen Abschnitt prüfen, Export herunterladen
- [ ] `CHANGELOG.md` unter `[Unreleased]`
- [ ] ADR nur, wenn die Entscheidung architektonisch ist
