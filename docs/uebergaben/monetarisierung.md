# Übergabe: Monetarisierung (Version 1.1.0)

Stand: 2026-10-12. Ausgangspunkt: Version 1.0.0. Die Änderung ist noch nicht veröffentlicht.

## Gebaut

- Seite `/projekte/:projectId/monetarisierung`, erreichbar über den Knopf **Monetarisierung** auf der Projektseite. Empfohlen ab 60 % Vollständigkeit, mit Inhalt in Problem, Zielgruppe und Kernfunktionen. Sonst zeigt die Seite, was fehlt, und bietet **Trotzdem starten** an.
- Schritt 1: Die KI schlägt 4 bis 6 Modelle aus einer festen Liste vor und bewertet sie nach sechs Kriterien von 1 bis 5. Man wählt ein Modell oder kombiniert bis zu drei. Modelle lassen sich auch von Hand ergänzen.
- Schritt 2 (sobald ein Modell außer „Nicht monetarisieren“ gewählt ist): 3 bis 5 Preisstrategien aus einer festen Liste. Beispielpreise als Spannen in Euro, ausdrücklich als Annahme. Bis zu zwei Strategien wählbar. Ändert man die Modellauswahl, werden die Preisstrategien verworfen.
- Schritt 3: **Monetarisierung abschließen** und **Wieder öffnen**. Regelbasierte Auswirkungen auf andere Abschnitte lassen sich per Klick als Stichpunkt übernehmen; vorhandener Text wird nie überschrieben. Hinweis auf der Seite: keine Rechts-, Steuer- oder Finanzberatung.
- Export: `BLUEPRINT.md` bekommt ein Kapitel „Monetarisierung“, `CLAUDE.md` und `AGENTS.md` enthalten dasselbe. Ist ein Modell außer „Nicht monetarisieren“ gewählt, ergänzt `TASKS.md` die Aufgabe „Bezahlfunktion umsetzen“. Ohne gewähltes Modell ist der Export unverändert. Der Reife-Check ist unverändert und die Monetarisierung blockiert den Export nie.
- Datenformat Version 4: neues Feld `project.monetization` (`null`, solange nicht begonnen). Migration v3 → v4 (`migrateV3ToV4` in `src/core/blueprint/migrations.ts`). Die Monetarisierung ist kein Eintrag in `SECTION_IDS` (ADR 0011).
- Kernlogik ohne React in `src/core/engine/monetization.ts`. UI in `src/features/monetization/`.
- Prompts `suggest-monetization-models` und `suggest-pricing-strategies` (jeweils Version 1) mit Golden Files.
- ADR 0011, Nutzerhandbuch, Architektur-Überblick, CLAUDE.md (Datenmodell) und CHANGELOG-Eintrag unter `[Unreleased]`.

## Prüfungen

- siehe PR

## Offen für Luca

- Manueller Test mit echtem OpenRouter-Key: Modelle und Preisstrategien vorschlagen lassen, Auswahl ändern, Export mit gewähltem Modell prüfen.
- Release v1.1.0 anlegen. Tags lassen sich aus der Cloud-Umgebung nicht pushen.
- Die Version in `package.json` wird erst beim Release auf 1.1.0 erhöht.

## Wie es weitergeht

Weiterentwicklung nach `docs/release-prozess.md`. Ideen für später stehen im Plan unter „Spätere Ideen“.
