# Übergabe nach Phase 5 – Entscheidungen & Vorschläge

- **Datum:** 2026-10-11
- **Version:** v0.5.0

## Was gebaut wurde

- `src/core/engine/decisions.ts`: Rangfolge (`rankDecisions`: Hebel × Unsicherheit des Abschnitts, die ersten
  sieben als Kern), Übernahme der KI-Kandidaten (`applyDecisionCandidates`), Zustandsänderungen (`decide`,
  `reopenDecision`, `dismissDecision`) und das Entscheidungsprotokoll (`chosenOption`).
- `src/core/engine/additions.ts`: Übernahme der Ergänzungsvorschläge (`applyAdditionCandidates`), `acceptAddition`
  (hängt den Punkt als Stichpunkt an den Abschnitt an) und `rejectAddition`.
- `src/core/engine/contradictions.ts`: `detectContradictions` mit festen Regeln (offline-first gegen Echtzeit,
  nur lokal gegen Konten, kostenlos gegen Abo, Web gegen nativ, KI gegen keine KI, Datenschutz gegen Tracking)
  sowie die Erkennung von Punkten, die zugleich Kernfunktion und Nicht-Ziel sind. ADR 0006.
- `src/core/engine/cleaning.ts`: gemeinsame Helfer für Begrenzung, Doppeltes und Hebelwerte.
- `src/core/ai/prompts`: versionierte Prompts `identify-decisions` (Version 1, `identifyDecisions.ts`, höchstens
  sieben Kernentscheidungen) und `suggest-additions` (Version 1, `suggestAdditions.ts`, Kernfunktionen, Nicht-Ziele,
  Risiken, höchstens vier je Abschnitt). Beide über `generateStructured`. Golden Files in `__golden__/`.
- `src/core/blueprint`: Schema Version 3 mit `project.decisions` (Optionen mit Vor- und Nachteilen, Folge,
  Empfehlung, gewählte Option, Begründung, Status `open`/`decided`/`dismissed`, Zeitpunkte) und `project.additions`
  (Status `open`/`accepted`/`rejected`/`dismissed`). Migration v2 → v3 in `migrations.ts`.
- `src/features/decisions`: Seite `DecisionsPage` unter `/projekte/:projectId/entscheidungen` mit `DecisionList`,
  `DecisionCard`, `DecisionLog`, `AdditionsPanel`, `ContradictionWarnings` und dem Hook `useDecisions`.
- `src/features/ai/useAiTask.ts`: gemeinsamer Hook für einzelne KI-Aufgaben in Features.
- `src/features/blueprint`: Link auf die Entscheidungsseite und Zähler der Widersprüche auf der Projektseite,
  Entscheidungsprotokoll auf der Projektseite.
- Neue Route in `src/app/routes.tsx`.

## Arbeitsweise

Kern (Schema v3 mit Migration, beide Prompts, Rangfolge, Übernahme und Widerspruchsregeln), der Hook `useDecisions`
und die ADR hat der Hauptentwickler gebaut. Tests und Golden Files, die Oberfläche, der E2E-Test und die Doku kamen
von Haiku-Helfern, parallel und anschließend geprüft.

Behobene Befunde bei der Prüfung:

- **Kürzung der KI-Kandidaten:** Zu viele Kandidaten wurden nach ihrer Position in der Antwort gekürzt. Jetzt kürzt
  der Kern nach Hebel, bei Entscheidungen und bei Fragen. Dadurch kommen weitere Entscheidungen unter „Weitere“.
- **Fehlalarme der Widerspruchsregeln:** Freemium, „Login ist nicht erforderlich“, „ohne den lästigen Login“,
  „entfällt“ und die zeitliche Staffelung „App-Store in Phase 2“ lösten Warnungen aus. Behoben, und die Fälle sind
  als Tests festgehalten.
- **Altdaten:** Entscheidungen mit nur einer Option oder ohne gewählte Option sperren das Projekt nicht mehr.
- **Aufzählungszeichen:** KI-Vorschläge mit Aufzählungszeichen führten zu „- - Text“. Behoben.
- **Veraltete IDs:** Klicks auf IDs, die es nicht mehr gibt (z. B. nach einer neuen Ermittlung), führen nicht mehr
  zu Fehlern.
- **Fundstellen:** Die Fundstellen der Widersprüche zeigen jetzt ihren eigenen Abschnitt.

## Architektur-Überblick

- **Reihenfolge:** `rankDecisions` entscheidet, nicht die KI. Die KI liefert Kandidaten, der Kern bereinigt sie
  (`applyDecisionCandidates`, `applyAdditionCandidates`). Eine neue Ermittlung überholt nur offene Einträge.
- **Vorschläge:** `acceptAddition` hängt nur an, der vorhandene Abschnittstext bleibt unverändert.
- **Widersprüche:** `detectContradictions` ist deterministisch und getestet. Die Widersprüche aus der KI-Analyse
  (Phase 4) werden zusätzlich angezeigt.
- **UI:** Alle Aktionen laufen über `useDecisions(editor)` und den `useProjectEditor` aus Phase 3, also mit
  Rückgängig/Wiederholen und automatischem Speichern.

## Teststand

- 1047 Unit- und Komponententests in 57 Dateien, alle grün.
- 19 E2E-Tests, alle grün. Davon 2 neu in `e2e/decisions.spec.ts`: „Vorschlag annehmen → erscheint im Blueprint“
  und „Entscheidung treffen → Protokoll, Widerspruch wird angezeigt“. OpenRouter wird per `page.route` gemockt.
- Abnahmetest `src/core/engine/decisions.acceptance.test.ts` mit gespeicherter KI-Antwort, ohne Netzwerk.
- Regressionstests für die Widerspruchsregeln mit positiven und negativen Beispielen.

## Datenkompatibilität

- Projekte aus v0.4.x werden beim Laden automatisch von Version 2 auf Version 3 migriert. Entscheidungen aus den
  Abschnitten wandern nach `decisions`, `additions` startet leer.
- Getestet mit der Fixture `src/core/blueprint/__fixtures__/project-v2.json` und der Kette v1 → v3.
- Unbrauchbare Alt-Entscheidungen werden beim Migrieren verworfen, statt das Projekt zu sperren.

## Bekannte offene Punkte

- **Manueller Test mit echtem Key steht aus:** Bitte einmal durchspielen:
  1. Projekt öffnen und „Entscheidungen & Vorschläge“ wählen.
  2. „Entscheidungen finden“ starten.
  3. Prüfen, dass 3–7 sinnvolle Kernentscheidungen in plausibler Reihenfolge erscheinen.
  4. Eine Entscheidung treffen.
  5. „Vorschläge holen“ starten, einen Vorschlag annehmen und im Blueprint prüfen.
- **Widerspruchsregeln** erkennen nur bekannte Schlagwörter. Feinere Widersprüche kommen weiter von der KI-Analyse.
- **Gewählte Optionen** ändern den Abschnittstext nicht automatisch. Das Protokoll steht daneben. Der Export
  kommt in Phase 7.
- **Qualität der Entscheidungen** hängt vom Modell ab. Der Kern kann nur ordnen und filtern, nicht bessere
  Entscheidungen erfinden.

## Erster Schritt in Phase 6

Laut `docs/implementierungsplan.md`, Phase 6 (Ideenfindung von Null): die Logik des kurzen Fragebogens (Interessen,
Fähigkeiten, verfügbare Zeit, Lernziel, Frust im Alltag, Plattform) mit Tests bauen, dazu das Ideen-Schema
(3–5 Ideen mit Kurzbeschreibung, Aufwand, Neuheit, Lernwert). Falls das Projektschema dafür geändert wird:
`CURRENT_SCHEMA_VERSION` auf 4, Migration in `migrations.ts` und Test mit einer Fixture der Version 3.
