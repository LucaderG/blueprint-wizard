# Übergabe nach Phase 4 – Intelligenter Fragenmotor

- **Datum:** 2026-10-11
- **Version:** v0.4.0

## Was gebaut wurde

- `src/core/engine`: deterministische Priorisierung (`prioritization.ts`: Score aus Hebel, Reifegrad und
  Abhängigkeiten, Blockaden, Rundenauswahl mit 1–3 Fragen) und Fragenmotor-Logik (`interview.ts`: `applyAnalysis`,
  `answerQuestion`, `deferQuestion`, `analyzeBlueprint`, `integrateAnswers`, `applyIntegration`,
  `appendAnswersToSections`), ADR 0005.
- `src/core/ai/prompts`: versionierte Prompts `analyze-blueprint` (Version 1) mit `blueprintAnalysisResultSchema`
  und `integrate-answers` (Version 1) mit `integrationResultSchema`, beide über `generateStructured`. Golden Files in
  `__golden__/`.
- `src/core/blueprint`: Schema Version 2 mit `project.interview` (`questions`, `log`, `analysis`) in `schema.ts`,
  Migration v1 → v2 in `migrations.ts`.
- `src/features/interview`: Seite `InterviewPage` unter `/projekte/:projectId/fragen` mit `AnalysisPanel`
  (Zusammenfassung, Lücken, Widersprüche), `QuestionRound` und `QuestionCard` (Option, Freitext, „Später“),
  `IntegrationReview` (Vorher/Nachher, Warnung bei starkem Kürzen), `InterviewHistory` und dem Hook `useInterview`.
- `src/features/blueprint`: Link „Fragen beantworten“ mit Zähler offener Fragen auf der Projektseite.
- Neue Route in `src/app/routes.tsx`.

## Arbeitsweise

Kern (Schema v2 mit Migration, beide Prompts, Priorisierung, Einarbeiten) und der Hook `useInterview` hat der
Hauptentwickler gebaut. Kern-Tests mit Golden Files, die Fragen-Oberfläche, der E2E-Test und die Doku kamen von
Haiku-Helfern, parallel und anschließend geprüft.

Behobene Fehler bei der Prüfung:

- Wechselt man direkt nach einer Änderung die Seite (z. B. von den Fragen zurück zum Projekt), zeigte die neue
  Seite den Stand vor dem letzten Speichern und hätte ihn beim Weiterbearbeiten zurückschreiben können. Seiten
  laden jetzt erst, wenn laufende Speichervorgänge fertig sind (`src/features/projects/pendingSaves.ts`).
  Gefunden durch den neuen E2E-Test.
- Bricht eine neue KI-Anfrage eine laufende ab, blieb deren Ladeanzeige stehen; behoben in `useInterview`.

## Architektur-Überblick

- **Reihenfolge:** `prioritization.ts` entscheidet, nicht die KI. Die KI liefert Kandidaten mit Hebel und
  Abhängigkeiten, der Kern bereinigt sie (`applyAnalysis`) und ordnet sie.
- **Antworten:** `answerQuestion` und `deferQuestion` schreiben den Verlauf mit. Der Verlauf speichert Fragetext und
  lesbare Antwort.
- **Einarbeiten:** `integrateAnswers` liefert nur Vorschläge. Übernommen wird über `applyIntegration` als
  `source: 'aiAccepted'`. Ohne KI oder nach Verwerfen hängt `appendAnswersToSections` die Antworten wörtlich an.
- **UI:** Alle Aktionen laufen über `useInterview(editor)` und den `useProjectEditor` aus Phase 3, also mit
  Rückgängig/Wiederholen und automatischem Speichern.

## Teststand

- 746 Unit- und Komponententests in 48 Dateien, alle grün.
- Abdeckung gesamt ca. 98 % Zeilen; `src/core/engine` bei 100 % Zeilen.
- Abnahmetest `src/core/engine/acceptance.test.ts` mit gespeicherter KI-Antwort (Fixture
  `src/core/engine/__fixtures__/analysis-vague.json`), ohne Netzwerk.
- Prompt-Regressionstests mit Golden Files (`src/core/ai/prompts/__golden__`).
- E2E-Test `e2e/interview.spec.ts` (OpenRouter per `page.route` gemockt).

## Datenkompatibilität

- Projekte aus v0.3.x werden beim Laden automatisch von Version 1 auf Version 2 migriert. Alte Abschnittsfragen
  wandern nach `interview.questions`, beantwortete Fragen werden zu Freitext-Antworten.
- Getestet mit der Fixture `src/core/blueprint/__fixtures__/project-v1.json`.

## Bekannte offene Punkte

- **Manueller Test mit echtem Key steht aus:** Bitte einmal durchspielen:
  1. Projekt mit vager Idee anlegen.
  2. Auf der Projektseite „Fragen beantworten“ wählen.
  3. „Blueprint analysieren“ starten.
  4. Prüfen, dass zuerst Grundsatzfragen kommen (Plattform, Zielgruppe, MVP-Umfang), keine Detailfragen.
  5. Eine Runde beantworten.
  6. Vorschläge zum Einarbeiten prüfen und übernehmen.
- **Qualität der Fragen** hängt vom Modell ab. Der Kern kann nur ordnen und filtern, nicht bessere Fragen erfinden.
- **Hinweis „blockierte Fragen“:** Der Hinweis bei einer leeren Runde erscheint in der Praxis nur selten.
- **Verlauf ohne einzelnes Rückgängig:** Eine beantwortete Frage lässt sich nicht einzeln zurücknehmen. Das geht nur
  über Rückgängig/Wiederholen der Seite.

## Erster Schritt in Phase 5

Das Entscheidungs-Schema (`decisionSchema` in `schema.ts`) gegen den Bedarf der Ansicht „Wichtigste Entscheidungen“
prüfen. Falls das Schema geändert wird: `CURRENT_SCHEMA_VERSION` auf 3, Migration in `migrations.ts` und Test mit
einer Fixture der Version 2. Danach die Sortierung nach Hebel mit den Werten aus `prioritization.ts` bauen.
