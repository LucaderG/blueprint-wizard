# ADR 0012: Einheitlicher Eintrag mit Papierkorb

- **Status:** Angenommen
- **Datum:** 2026-10-12
- **Phase:** Nach Phase 9 (Version 1.2.0)

## Kontext

Aus einer Idee in einem Satz soll die App ein bis drei Varianten als Steckbrief erzeugen. Luca hat im Grilling am 12.10.2026 entschieden: Projekte, Steckbriefe, Varianten und Ideen aus der Ideenfindung werden gleich behandelt und gleich gespeichert. Eine Bibliothek ersetzt die Projektliste. Erzeugtes, das niemand speichert, und alles Gelöschte liegt eine einstellbare Frist (1, 7 oder 30 Tage) im Papierkorb und wird danach endgültig gelöscht.

Offen war, ob Steckbriefe einen eigenen Datentyp mit eigener Tabelle brauchen.

## Entscheidung

- Jeder Eintrag bleibt ein `Project`. Das Projektformat wird Version 5 und bekommt zwei Felder:
  - `profile`: der Steckbrief oder `null`. Felder: `pitch`, `problem`, `audience`, `features`, `platform`, `monetization` als Text (`model`, `priceRange`, `reason`), `effort` (`small`, `medium`, `large`) und `risks`. Der Titel ist der Projektname.
  - `library`: `{ status: 'saved' | 'trashed', trashedAt }`. `trashedAt` ist genau dann gesetzt, wenn der Eintrag im Papierkorb liegt.
- Es gibt keine Art-Spalte. Was ein Eintrag ist, ergibt sich aus dem Inhalt: nur Steckbrief, ausgearbeitet oder Projekt ohne Steckbrief.
- Die Grenzen für KI-Steckbriefe (5 bis 8 Funktionen, 2 bis 3 Risiken) gelten beim Bereinigen der KI-Antwort. Das Schema lässt Bearbeitung von Hand zu.
- Die Monetarisierung im Steckbrief ist nur Text. Sie wird nicht in `project.monetization` übernommen (ADR 0011).
- Die Migration v4 → v5 setzt `profile: null` und `library: { status: 'saved', trashedAt: null }`. Alle bestehenden Projekte stehen danach unverändert in der Bibliothek.
- Die Dexie-Tabelle `projects` bleibt. Filter nach Status laufen in `projectOperations.ts` im Speicher.

## Konsequenzen

- Repository, Editor, Export und JSON-Sicherung gelten ohne Sonderfall für alle Einträge.
- Das Repository bekommt Papierkorb-Methoden; das bisherige Löschen verschiebt in den Papierkorb. Endgültig gelöscht wird nur, was im Papierkorb liegt und dessen Frist abgelaufen ist.
- Der Steckbrief ist eine zweite Struktur neben den Abschnitten, wie die Monetarisierung.
- Die Schemaänderung braucht die Migration v4 → v5 und einen Test mit der echten v4-Fixture (`src/core/blueprint/__fixtures__/project-v4.json`).

## Erwogene Alternativen

- **Eigener Typ und eigene Tabelle für Steckbriefe:** Doppelte Logik für Speichern, Sichern und Papierkorb. Widerspricht Lucas Entscheidung, alles gleich zu behandeln.
- **Art-Feld (`kind: project | profile | idea`):** Muss bei jedem Ausarbeiten nachgeführt werden und kann dem Inhalt widersprechen.
- **Index auf `library.status` in IndexedDB:** Bei wenigen hundert Einträgen unnötig und eine zusätzliche Dexie-Version.
