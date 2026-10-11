# ADR 0006: Entscheidungen, Vorschläge und Widerspruchswarnungen

- **Status:** Angenommen
- **Datum:** 2026-10-11
- **Phase:** Phase 5

## Kontext

Die App soll zeigen, welche Entscheidungen den größten Unterschied machen, sinnvolle Ergänzungen vorschlagen
und vor Widersprüchen warnen. Entscheidungen sollen mit Begründung festgehalten werden und Teil des Blueprints
sein. Wie in Phase 4 gilt: Die KI liefert Inhalte, aber Reihenfolge und Zustandsänderungen müssen
nachvollziehbar und testbar bleiben. Bisher lagen Entscheidungen pro Abschnitt im Schema, ohne Vor- und
Nachteile, Status oder Zeitpunkt.

## Entscheidung

- **Datenmodell v3:** Entscheidungen liegen projektweit in `project.decisions` (Abschnitt, Titel, Kontext,
  Hebel, 2–4 Optionen mit Vor-/Nachteilen und Folge, empfohlene und gewählte Option, Begründung, Status
  `open`/`decided`/`dismissed`, Zeitpunkte). Neu ist `project.additions` für Ergänzungsvorschläge
  (`open`/`accepted`/`rejected`/`dismissed`). Die Migration v2 → v3 verschiebt alte Abschnittsentscheidungen.
- **Zwei versionierte Prompts:** `identify-decisions` (höchstens sieben Kernentscheidungen) und
  `suggest-additions` (Kernfunktionen, Nicht-Ziele, Risiken; höchstens vier je Abschnitt).
- **Rangfolge im Kern:** `rankDecisions` sortiert offene Entscheidungen nach Hebel × Unsicherheit des
  Abschnitts (wie der Fragenmotor) und zeigt die ersten sieben als Kern. Getroffene Entscheidungen bilden das
  Entscheidungsprotokoll in zeitlicher Reihenfolge.
- **Bereinigen statt ablehnen:** `applyDecisionCandidates` und `applyAdditionCandidates` begrenzen Werte,
  entfernen Doppeltes und alles, was schon entschieden, verworfen, angenommen oder abgelehnt ist oder bereits
  im Abschnitt steht. Eine neue Ermittlung überholt nur offene Einträge.
- **Vorschlag annehmen = Stichpunkt anhängen:** `acceptAddition` hängt den Punkt an den Abschnitt an, ohne
  vorhandenen Inhalt zu verändern.
- **Widersprüche regelbasiert:** `detectContradictions` prüft feste Regeln (z. B. offline-first gegen Echtzeit,
  nur lokal gegen Konten, kostenlos gegen Abo) über Abschnittsinhalte und gewählte Optionen und erkennt
  Punkte, die zugleich Kernfunktion und Nicht-Ziel sind. Verneinte Fundstellen zählen nicht. Die Widersprüche
  aus der KI-Analyse (Phase 4) werden zusätzlich angezeigt.

## Konsequenzen

- Widerspruchswarnungen sind sofort da, kosten nichts und sind mit Beispielfällen testbar; sie erkennen aber
  nur, was die Regeln kennen. Feinere Widersprüche kommen weiter von der KI-Analyse.
- Gewählte Optionen ändern den Abschnittstext nicht automatisch; das Protokoll steht daneben. Phase 7 nimmt
  Protokoll und Abschnitte gemeinsam in den Export auf.
- Neue Widerspruchsregeln brauchen einen Test mit positivem und negativem Beispiel und einen i18n-Text unter
  `decisions.contradictions.rules.<id>`.

## Erwogene Alternativen

- **Widersprüche nur per KI:** flexibler, aber nicht deterministisch, kostet Anfragen und ist schwer zu testen.
- **Gewählte Option direkt in den Abschnitt schreiben:** bequemer, würde aber Nutzerinhalt verändern.
- **Entscheidungen weiter pro Abschnitt:** eine Rangfolge über alle Abschnitte wäre umständlich.
