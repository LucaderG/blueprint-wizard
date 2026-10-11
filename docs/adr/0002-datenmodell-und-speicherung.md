# ADR 0002: Datenmodell und Speicherung

- **Status:** Angenommen
- **Datum:** 2026-10-11
- **Phase:** Phase 1

## Kontext

Alle drei Einstiege (keine Idee, Teil-Idee, fast fertig) sollen in denselben Blueprint-Zustand münden.
Projekte liegen nur lokal im Browser, und die App wird über viele Phasen weiterentwickelt. Gespeicherte
Projekte und Exportdateien müssen deshalb auch nach Schemaänderungen lesbar bleiben.

## Entscheidung

- **Ein Schema als Quelle der Wahrheit:** Zod-Schemas in `src/core/blueprint/schema.ts` definieren
  Projekt, Blueprint, Abschnitt, Entscheidung und Frage; die TypeScript-Typen werden daraus abgeleitet.
- **Feste Abschnittsliste:** Der Blueprint ist ein Objekt mit genau einem Eintrag pro `SECTION_IDS`
  (`src/core/blueprint/sections.ts`). Gewichte für den Vollständigkeits-Score stehen daneben, Anzeigenamen
  in den i18n-Dateien.
- **Reifegrad pro Abschnitt** (`empty` / `vague` / `decided`). Der Vollständigkeits-Score ist das
  gewichtete Mittel (0 / 0,5 / 1). Grundsatzabschnitte (Problem, Kernfunktionen) wiegen dreifach.
- **Versioniertes Format:** Jedes Projekt trägt `schemaVersion`. `migrateProject` hebt alte Daten
  Schritt für Schritt an und validiert danach. Neuere Versionen werden mit `unsupportedVersion` abgelehnt,
  statt sie still zu beschädigen.
- **Repository-Schnittstelle:** `ProjectRepository` kapselt die Speicherung. `DexieProjectRepository`
  (IndexedDB) für die App, `MemoryProjectRepository` für Tests. Gemeinsame Logik liegt in
  `projectOperations.ts`, und eine Vertrags-Testsuite prüft beide Implementierungen gleich.
- **Migration beim Lesen:** Die IndexedDB-Variante migriert Datensätze beim Laden und schreibt sie
  aktualisiert zurück. Beschädigte Datensätze werden in der Liste übersprungen, aber nie gelöscht.
- **Exportformat:** JSON-Hülle `{ format: 'blueprint-wizard/project', exportedAt, project }`. Ein Import
  bekommt immer eine neue ID, damit nichts überschrieben wird.
- **Bezeichner im Code sind Englisch**, Kommentare, Doku und UI Deutsch.

## Konsequenzen

- Neue Abschnitte oder Felder erfordern: Schema anpassen, `CURRENT_SCHEMA_VERSION` erhöhen, Migration und
  Test ergänzen. Das ist etwas Aufwand, verhindert aber kaputte Altprojekte.
- KI-Antworten können ab Phase 2 gegen dieselben Schemas validiert werden.
- Die Dexie-Tabelle speichert ganze Projekte als Dokument. Für die erwartete Datenmenge (einige Dutzend
  Projekte) ist das ausreichend; Suche oder Teilabfragen über Abschnitte gibt es nicht.

## Erwogene Alternativen

- **localStorage:** einfacher, aber auf etwa 5 MB begrenzt und synchron. Verworfen.
- **Abschnitte als eigene Tabelle:** feinere Updates, aber mehr Komplexität ohne erkennbaren Nutzen. Verworfen.
- **Deutsche Bezeichner im Code** (wie im Plan skizziert): würde sich mit Bibliotheks-APIs mischen.
  Verworfen zugunsten durchgängig englischer Bezeichner.
