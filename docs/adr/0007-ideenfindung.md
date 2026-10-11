# ADR 0007: Ideenfindung von Null

- **Status:** Angenommen
- **Datum:** 2026-10-11
- **Phase:** Phase 6

## Kontext

Wer ohne Idee startet, soll trotzdem in wenigen Minuten zu einem gefüllten Start-Blueprint kommen. Der Plan sieht
einen kurzen Fragebogen vor (Interessen, Fähigkeiten, Zeit, Lernziel, Frust im Alltag, Plattform), 3–5 Ideen mit
Aufwand, Neuheit und Lernwert, Verfeinern, Kombinieren und Neu würfeln sowie die Übergabe der gewählten Idee an
den normalen Wizard. Aus Phase 5 (v0.5.1) wissen wir: Viele einzelne Bestätigungsschritte machen den Ablauf mühsam.

## Entscheidung

- **Kein neues Projektschema:** Fragebogen und Ideen leben vor dem Projekt. Der Stand liegt im `sessionStorage`
  (`ideationSessionSchema`, `parseIdeationSession` verwirft Ungültiges) und überlebt Neuladen, aber nicht das
  Schließen des Tabs. Erst die gewählte Idee wird ein Projekt. Damit bleibt das Datenformat bei Version 3.
- **Fragebogen auf einer Seite:** Alle sechs Fragen sind freiwillig. Ideen lassen sich erzeugen, sobald es einen
  inhaltlichen Ansatzpunkt gibt (Interessen, Frust oder Lernziel; `profileStatus`). Schlagwörter werden im Kern
  bereinigt (`cleanTags`, `normalizeProfile`).
- **Ein versionierter Prompt für alle Aktionen:** `generate-ideas` bekommt den Fragebogen, eine `IdeaRequest`
  (`generate`, `moreLike`, `refine` mit `simpler`/`bolder`/`custom`, `combine`) und die schon gezeigten Titel.
  Neue Runden erbitten vier Ideen, Abwandeln und Kombinieren genau eine.
- **Bereinigen und Einbauen im Kern:** `cleanIdeaCandidates` entfernt leere und doppelte Ideen und begrenzt
  Werte; `applyIdeas` legt fest, wie das Ergebnis in die Liste kommt (ersetzen, Vorbild vorn, an gleicher Stelle
  ersetzen, kombinierte Idee vorn; höchstens fünf). Bringt die KI nichts Brauchbares, bleibt die Liste gleich.
- **Übergabe ohne Umweg:** `ideaToClassification` macht aus der Idee eine Einordnung (Problem, Zielgruppe,
  Kernfunktionen, Tech-Stack; Reife „vage“), `applyChosenIdea` legt sie über `applyClassification` an. Weil die
  Person die Idee bewusst gewählt hat, gelten die Abschnitte als bestätigter KI-Inhalt (`aiAccepted`). Ein
  zweiter KI-Aufruf zum Einordnen entfällt.

## Konsequenzen

- Prompt, Bereinigung und Einbau sind ohne Netzwerk testbar (Golden Files, Tabellentests).
- Der Fragebogen ist nach dem Wählen einer Idee weg; er beeinflusst das Projekt nur über die Idee.
- Die Qualität der Ideen hängt vom Modell ab; der Kern sorgt nur für Form, Grenzen und Wiederholungsfreiheit.

## Erwogene Alternativen

- **Fragebogen als Schritt-für-Schritt-Assistent:** übersichtlich, aber mehr Klicks; widerspricht der
  Rückmeldung zum Fragen-Ablauf.
- **Ideen im Projekt speichern (Schema v4):** erlaubt späteres Zurückspringen, kostet aber eine Migration für
  Daten, die nach der Wahl niemand mehr braucht.
- **Gewählte Idee per `classify-idea` einordnen lassen:** ein zusätzlicher, langsamer KI-Aufruf ohne Mehrwert,
  da die Idee schon strukturiert vorliegt.
