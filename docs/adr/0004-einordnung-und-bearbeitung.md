# ADR 0004: Einordnung und Bearbeitung von Projekten

- **Status:** Angenommen
- **Datum:** 2026-10-11
- **Phase:** Phase 3

## Kontext

Der Freitext aus den Einstiegsseiten soll per KI auf die zehn Blueprint-Abschnitte verteilt werden. Die
Antwort ist nicht verlässlich: Sie kann Inhalte erfinden, Abschnitte falsch zuordnen oder fehlschlagen. Gleichzeitig
hat der Nutzer eigene Texte im Blueprint, die nicht verloren gehen dürfen. Beim Bearbeiten sollen Rückgängig,
Wiederholen und Speichern ohne Datenverlust funktionieren, ohne dass jede Seite eigene Speicherlogik hat.

## Entscheidung

- **Einordnung über versionierten Prompt:** `classify-idea` (`src/core/ai/prompts/classifyIdea.ts`, Version 1)
  wird über `generateStructured()` mit `classificationSchema` aufgerufen. Die Temperatur ist 0,2, damit die
  Zuordnung möglichst gleichbleibend ausfällt. Inhaltliche Prompt-Änderungen erhöhen die Version.
- **KI-Inhalt ist ein Vorschlag:** `applyClassification` (`src/core/engine/classification.ts`) setzt Inhalte
  als `source: 'aiSuggestion'`, bis der Nutzer sie übernimmt (`acceptSuggestion`). Eigener Inhalt des Nutzers
  (`source: 'user'`) wird nie überschrieben; solche Abschnitte werden übersprungen und gemeldet.
- **Erst einordnen, dann anlegen:** Das Projekt wird erst nach einer erfolgreichen KI-Antwort angelegt. Fehler,
  Abbruch oder Timeout hinterlassen damit keine leeren Projekte.
- **Bearbeiten über reine Funktionen:** Änderungen an Abschnitten sind Funktionen wie `updateSection`
  (`src/core/blueprint/editing.ts`), die ein neues Projekt liefern. Seiten nutzen sie nur über `useProjectEditor`.
- **Verlauf im Speicher:** `history.ts` hält Vergangenes und Zukünftiges als Stapel mit höchstens 50 Schritten.
  Der Verlauf lebt nur während eines Seitenbesuchs.
- **Automatisches Speichern:** Nach 600 ms ohne Änderung wird gespeichert. Speichervorgänge laufen nacheinander
  und schreiben immer den neuesten Stand. Beim Verlassen der Seite, beim Schließen des Tabs und beim Wechsel zu
  einem anderen Projekt wird sofort gespeichert (`flush`).

## Konsequenzen

- Der Nutzer muss KI-Vorschläge bestätigen. Das kostet einen Klick, verhindert aber stille Fehler im Blueprint.
- Eigene Inhalte bleiben bei jeder Einordnung erhalten. Wer eine KI-Neuzuordnung für einen Abschnitt will,
  muss den eigenen Text vorher löschen.
- Der Verlauf geht beim Neuladen verloren. Das ist für die bisherige Nutzung ausreichend.
- Neue Änderungen am Projekt gehen über `useProjectEditor` und die reinen Funktionen. Direkte Schreibzugriffe
  aus Seiten sind zu vermeiden.
- Die Einordnung braucht einen Key und eine erreichbare KI. Ohne Key bleibt nur der Start ohne KI.

## Erwogene Alternativen

- **Undo-Verlauf persistieren:** Würde den Verlauf über Neuladen retten, vergrößert aber die gespeicherten
  Projekte und macht das Speicherformat komplexer. Verworfen für diese Phase.
- **Projekt vor dem KI-Aufruf anlegen:** Der Nutzer sieht sofort ein Projekt, bei Fehlern bleiben aber leere
  Reste zurück. Verworfen.
- **KI überschreibt alles:** Am einfachsten, zerstört aber eigene Texte des Nutzers bei jeder Einordnung.
  Verworfen.
