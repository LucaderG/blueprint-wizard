# Übergabe nach Phase 3 – Wizard-Gerüst & Einstiegspunkte

- **Datum:** 2026-10-11
- **Version:** v0.3.0

## Was gebaut wurde

- `src/core/engine`: `classifyIdea` (KI-Einordnung) und `applyClassification` (Vorschläge übernehmen, eigenen Inhalt
  schützen), ADR 0004.
- `src/core/ai/prompts`: versionierter Prompt `classify-idea` (Version 1) mit `classificationSchema`.
- `src/core/blueprint`: reine Bearbeitungsfunktionen (`editing.ts`) und Verlauf mit 50 Schritten (`history.ts`).
- `src/features/wizard`: Einstiegsseiten `/neu/keine-idee`, `/neu/teil-idee`, `/neu/fast-fertig`, Eingabeformular mit
  Textupload, „Idee einordnen“ und „Ohne KI starten“.
- `src/features/projects`: `useProjectEditor` (Bearbeiten, Rückgängig/Wiederholen, automatisches Speichern).
- `src/features/blueprint`: Blueprint-Übersicht mit Abschnittskarten, Reifegrad, Speicherstatus und
  Tastenkürzel für Rückgängig/Wiederholen.

## Arbeitsweise

Kern (Einordnung, Prompt, Bearbeitung, Verlauf, Autosave-Hook) hat der Hauptentwickler gebaut. Die Tests für den
Kern, die Einstiegsseite und die Blueprint-Übersicht wurden von Haiku-Helfern parallel geschrieben und geprüft.

Behobene Fehler bei der Prüfung:

- Ausstehende Änderungen werden jetzt auch beim direkten Wechsel zwischen zwei Projekten gespeichert.
- Text, der bei „Keine Idee“ eingegeben wurde, bleibt beim Start ohne KI erhalten.

## Teststand

- 506 Unit- und Komponententests, 16 E2E-Tests, alle grün; `src/core` bei 100 % Abdeckung.

## Bekannte offene Punkte

- **Manueller Test mit echtem Key steht aus:** Bitte einmal Startseite → „Ich habe eine Teil-Idee“ → Text →
  „Idee einordnen“ mit echtem Key durchspielen.
- Der Hinweis „Gespeichert“ auf der Einstellungsseite bleibt sichtbar, bis die Seite neu geladen wird (aus Phase 2).
- Der Reifegrad „leer“ ist auch bei vorhandenem Inhalt wählbar. Die Auswahl „vage“/„entschieden“ ist nur bei
  Abschnitten ohne Inhalt deaktiviert.
- Der Undo-Verlauf gilt pro Seitenbesuch und wird nicht gespeichert.
- Geführte Ideenfindung für „Ich habe keine Idee“ kommt in Phase 6.

## Erster Schritt in Phase 4

Gap-Analyse-Prompt in `src/core/ai/prompts/` (Lücken, Widersprüche, Reife) als versionierter Prompt mit
`generateStructured`. Danach die deterministische Priorisierung der Fragen in `src/core/engine`.
