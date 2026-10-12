# ADR 0011: Monetarisierung als eigene Struktur

- **Status:** Angenommen
- **Datum:** 2026-10-12
- **Phase:** Nach Phase 9 (Version 1.1.0)

## Kontext

Der Blueprint soll zeigen, wie ein Projekt Geld einbringen kann: Modelle, Preise und Begründung. Offen war, wo diese Angaben liegen. Ein elfter Abschnitt in `SECTION_IDS` passt aus drei Gründen nicht:

- `checkReadiness` zählt jeden leeren Abschnitt als offenen Punkt. Ein Pflichtabschnitt würde Blueprints ohne Monetarisierung, etwa für Hobby- oder Lernprojekte, nie als fertig gelten lassen.
- Die Angaben sind strukturiert: Bewertungen je Modell, eine Auswahl und ein Status. Freitext passt dazu nicht.
- Ein neuer Abschnitt braucht die 24 Stellen aus `docs/neuer-abschnitt.md`.

## Entscheidung

- Die Monetarisierung ist eine eigene Struktur in `project.monetization`. Sie ist kein Eintrag in `SECTION_IDS`. Das Feld ist `null`, solange die Monetarisierung nicht begonnen wurde.
- Modelle und Preisstrategien stammen aus festen Listen. Die KI erfindet keine eigenen Modelle oder Strategien.
- Preise stehen nur als Spannen in Euro. Sie sind ausdrücklich eine Annahme und keine Marktdaten.
- KI-Ergebnisse bereinigen `applyModelCandidates` und `applyPricingCandidates`. Doppelte Einträge fallen weg, Bewertungen werden auf 1 bis 5 begrenzt, Obergrenzen gelten.
- Die Auswahl ist auf bis zu drei Modelle und bis zu zwei Preisstrategien begrenzt. „Nicht monetarisieren“ lässt sich mit keinem anderen Modell kombinieren.
- Das Projektformat wird Version 4. Die Migration v3 → v4 setzt `monetization: null`. Die Exportversion (`EXPORT_VERSION`) bleibt 1.
- Der Export ergänzt das Kapitel nur, wenn ein Modell gewählt ist. Der Reife-Check bleibt unverändert. Die Monetarisierung blockiert den Export nie.

## Konsequenzen

- Blueprints ohne Monetarisierung können fertig werden. Bestehende Projekte bleiben ohne Monetarisierung gültig.
- Neben den Abschnitten gibt es eine zweite Struktur. Auswirkungen auf Abschnitte landen nur als Stichpunkt im Text, nicht in eigenen Feldern. Vorhandener Text wird nie überschrieben.
- Die KI-Ergebnisse brauchen Bereinigung und Tests. Inhaltliche Prompt-Änderungen erhöhen die VERSION und erzeugen neue Golden Files.
- Die Schemaänderung braucht die Migration v3 → v4 und einen Test mit der echten v3-Fixture (`src/core/blueprint/__fixtures__/project-v3.json`).

## Erwogene Alternativen

- **Abschnitt in `SECTION_IDS`:** Passt zum Schema, macht die Monetarisierung aber zur Pflicht für den Reife-Check und verlangt die 24 Stellen aus `docs/neuer-abschnitt.md`.
- **Speicherung als Entscheidungen in `project.decisions`:** Eine Entscheidung hat genau eine gewählte Option. Mehrfachauswahl und Bewertungen passen nicht hinein.
