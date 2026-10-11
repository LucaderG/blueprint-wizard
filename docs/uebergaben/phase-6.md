# Übergabe nach Phase 6 – Ideenfindung von Null

- **Datum:** 2026-10-11
- **Version:** v0.6.0

## Was gebaut wurde

- `src/core/ideation/profile.ts`: Fragebogen (Interessen, Frust im Alltag, Fähigkeiten, Lernziel, verfügbare
  Zeit, Plattform), Bereinigung der Schlagwörter (`cleanTags`, `addTags`, `toggleTag`), `normalizeProfile` und
  `profileStatus` (Ideen gibt es ab Interessen, Frust oder Lernziel).
- `src/core/ideation/session.ts`: Schema einer Idee (Titel, Kurzbeschreibung, Problem, Zielgruppe, Kernfunktionen,
  Plattform, Aufwand, Neuheit 1–5, Lernwert 1–5, Lernnotiz) und der Sitzung, `parseIdeationSession`.
- `src/core/ai/prompts/generateIdeas.ts`: Prompt `generate-ideas` (Version 1) für neue Runden, „Mehr wie diese“,
  Abwandeln (einfacher, ehrgeiziger, eigener Wunsch) und Kombinieren. Golden Files in `__golden__/`.
- `src/core/engine/ideation.ts`: `generateIdeas`, `cleanIdeaCandidates`, `titlesToAvoid`, `applyIdeas`,
  `ideaToClassification` und `applyChosenIdea` (Projekt aus der Idee, Abschnitte als `aiAccepted`). ADR 0007.
- `src/features/ideation`: `IdeationPage` (unter `/neu/keine-idee`), `Questionnaire`, `TagField`, `ChoiceChips`,
  `IdeaList`, `IdeaCard`, `IdeationStatus` und der Hook `useIdeation` (Stand im `sessionStorage`).

## Arbeitsweise

Kernlogik, Prompt, Hook, Oberfläche und Doku hat der Hauptentwickler gebaut. Kern-, Seiten- und E2E-Tests kamen von
zwei Haiku-Helfern parallel und wurden geprüft. Behobene Befunde aus der Prüfung:

- Beim Kombinieren mit schon fünf Ideen konnte eine der beiden Ausgangsideen herausfallen. Jetzt streicht das
  Kürzen zuerst andere Ideen.
- Abgewandelte oder kombinierte Ideen konnten den Titel einer anderen Karte tragen. Das wird jetzt verhindert.
- Zu lange Titel der KI hätten das Anlegen des Projekts scheitern lassen (Projektname höchstens 120 Zeichen). Titel
  werden jetzt gekürzt.
- Scheiterte das Anlegen des Projekts, sah man keine Meldung. Jetzt erscheint ein Hinweis, die Ideen bleiben.
- Rücktaste im leeren Schlagwortfeld löschte versehentlich das letzte Schlagwort; das Verhalten ist entfernt.

## Tests

- Kern: Tests für Fragebogen, Sitzung, Prompt (Golden Files für sechs Fälle) und Engine; die neuen Kerndateien
  sind vollständig abgedeckt.
- Seite: `src/features/ideation/IdeationPage.test.tsx` (Fragebogen, Schlagwörter, Ideen, Abwandeln, Kombinieren,
  Übernahme, Fehler, Abbruch, Neuladen, Start ohne KI).
- E2E: `e2e/ideation.spec.ts` „keine Idee → Idee gewählt → Wizard startet“.

## Datenkompatibilität

Kein Schemawechsel, Datenformat bleibt Version 3. Projekte aus v0.5.x laden unverändert.

## Bekannte offene Punkte

- **Manueller Test mit echtem Key steht aus:** Startseite → „Ich habe keine Idee“, Fragebogen ausfüllen, „Ideen
  finden“, eine Idee abwandeln, zwei kombinieren, eine Idee nehmen und auf der Projektseite prüfen.
- Die Qualität der Ideen hängt vom Modell ab. Ein sehr kleines Modell kann sich wiederholen; der Kern verwirft dann
  doppelte Titel und meldet „keine neue Idee“.
- Der Fragebogen wird nach der Wahl einer Idee nicht im Projekt gespeichert.

## Erster Schritt in Phase 7

Laut `docs/implementierungsplan.md`, Phase 7 (Blueprint-Generierung & Export): die Generatoren für `BLUEPRINT.md`,
`CLAUDE.md`/`AGENTS.md`, `TASKS.md` und den Start-Prompt als reine Funktionen in `src/core` mit Snapshot-Tests bauen,
danach Reife-Check, Vorschau und ZIP-Export.
