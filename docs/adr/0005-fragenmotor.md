# ADR 0005: Fragenmotor – KI schlägt vor, Kern priorisiert

- **Status:** Angenommen
- **Datum:** 2026-10-11
- **Phase:** Phase 4

## Kontext

Die App soll die richtigen Fragen in der richtigen Reihenfolge stellen: bei einem vagen Blueprint zuerst
Grundsatzfragen (Plattform, Zielgruppe, MVP-Umfang), keine Details. Eine KI kann gute Fragen formulieren, ihre
Reihenfolge ist aber nicht reproduzierbar und schwer zu testen. Antworten sollen in die Abschnitte einfließen,
ohne dass vorhandener Inhalt verloren geht, und es soll nachvollziehbar bleiben, welche Frage wann wie beantwortet
wurde. Bisher lagen Fragen pro Abschnitt im Schema, ohne Optionen, Abhängigkeiten oder Verlauf.

## Entscheidung

- **Zwei Prompts, beide versioniert:** `analyze-blueprint` liefert Zusammenfassung, Lücken, Widersprüche und
  höchstens acht Fragen-Kandidaten (Abschnitt, Begründung, Hebel 1–5, bis zu vier Optionen, Abhängigkeiten über
  lokale Schlüssel). `integrate-answers` formuliert die betroffenen Abschnitte mit den Antworten einer Runde neu.
- **Die KI bestimmt nicht die Reihenfolge.** `src/core/engine/prioritization.ts` rechnet deterministisch:
  Score = Hebel × Unsicherheit (Reifegrad leer 3, vage 2, entschieden 1) × (1 + 0,5 je wartender Frage).
  Zurückgestellt werden Fragen mit offener Abhängigkeit, Fragen zu Abschnitten mit leerer Voraussetzung
  (`SECTION_PREREQUISITES`) und Detailfragen (Hebel ≤ 2), solange `problem`, `audience` oder `features` leer ist.
  Eine Runde umfasst 1–3 Fragen; „Später“ gestellte Fragen kommen erst wieder, wenn nichts anderes offen ist.
- **KI-Antworten werden bereinigt statt abgelehnt:** `applyAnalysis` begrenzt den Hebel, entfernt doppelte oder
  einzelne Optionen, bildet Schlüssel auf IDs ab und bricht Abhängigkeitskreise. Eine neue Analyse ersetzt offene
  Fragen (`dismissed`); beantwortete und zurückgestellte bleiben.
- **Einarbeiten mit Bestätigung:** `integrateAnswers` liefert nur Vorschläge (vorher/nachher). Übernommen wird
  mit `applyIntegration` als `source: 'aiAccepted'`, weil die Person den Text geprüft hat. Wird der Text deutlich
  kürzer, warnt die Oberfläche (`isSuspiciousShrink`). Ohne KI oder nach einem Fehler hängt
  `appendAnswersToSections` die Antworten wörtlich an.
- **Datenmodell v2:** Fragen liegen projektweit in `project.interview` (`questions`, `log`, `analysis`).
  Die Migration v1 → v2 verschiebt alte Abschnittsfragen dorthin. Der Verlauf (`log`) speichert Fragetext und
  lesbare Antwort, damit er auch nach späteren Änderungen an den Fragen lesbar bleibt.

## Konsequenzen

- Reihenfolge und Blockaden sind mit Tabellen-Tests prüfbar; der Abnahmetest läuft mit einer gespeicherten
  KI-Antwort ohne Netzwerk.
- Prompt-Änderungen zeigen sich in den Golden Files (`src/core/ai/prompts/__golden__`).
- Die Qualität der Fragen hängt weiter vom Modell ab; der Kern kann nur ordnen und filtern.
- Entscheidungen (Phase 5) können später auf dieselben Hebel-Werte und Abhängigkeiten aufbauen.

## Erwogene Alternativen

- **KI liefert die fertige Reihenfolge:** einfacher, aber nicht reproduzierbar und nicht testbar.
- **Fragen pro Abschnitt behalten:** Abhängigkeiten zwischen Abschnitten und ein gemeinsamer Verlauf wären umständlich.
- **Antworten direkt in Abschnitte schreiben:** schneller, aber die KI könnte unbemerkt Inhalt entfernen.
