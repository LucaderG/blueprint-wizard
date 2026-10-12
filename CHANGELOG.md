# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), und das Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Hinzugefügt

- Versionsanzeige: Unten auf jeder Seite steht die Version mit Kanal, z. B. „Version v1.0.0 · stable“ für ein Release oder „Version v1.0.0 · nightly · abc1234“ für Pull Requests und ungetaggte Stände. Nach einem neuen Release baut der Release-Workflow die öffentliche Seite neu, damit sie „stable“ zeigt.
- Monetarisierung: Neue Seite `/projekte/:projectId/monetarisierung`, erreichbar über den Knopf „Monetarisierung“ auf der Projektseite. Empfohlen ist sie ab 60 % Vollständigkeit und mit Inhalt in Problem, Zielgruppe und Kernfunktionen. Fehlt etwas, zeigt sie, was fehlt, und bietet „Trotzdem starten“ an.
- Schritt 1 „Monetarisierungsmodelle“: Die KI schlägt 4 bis 6 Modelle aus einer festen Liste vor und bewertet sie nach sechs Kriterien von 1 bis 5 Punkten. Eine Vergleichstabelle zeigt alle Bewertungen. Man wählt ein Modell oder kombiniert bis zu drei. „Nicht monetarisieren“ lässt sich nicht kombinieren. Modelle lassen sich auch ohne KI von Hand ergänzen.
- Schritt 2 „Preisstrategie“: Erscheint, sobald ein Modell außer „Nicht monetarisieren“ gewählt ist. Die KI schlägt 3 bis 5 Preisstrategien vor. Beispielpreise stehen als Spannen in Euro und ausdrücklich als Annahme, nicht als Marktdaten. Bis zu zwei Strategien sind wählbar, auch von Hand ergänzbar. Ändert man die Modellauswahl, werden die Preisstrategien verworfen.
- Schritt 3 „Abschließen“: „Monetarisierung abschließen“ und „Wieder öffnen“. Regelbasierte Auswirkungen auf andere Abschnitte (z. B. Zahlungsanbieter, Nutzerkonten, Datenschutz bei Werbung) lassen sich per Klick als Stichpunkt übernehmen. Vorhandener Text wird nie überschrieben.
- Export: `BLUEPRINT.md` bekommt ein Kapitel „Monetarisierung“, sobald ein Modell gewählt ist. `CLAUDE.md` und `AGENTS.md` enthalten eine kurze Fassung davon. Hat man ein Modell außer „Nicht monetarisieren“ gewählt, ergänzt `TASKS.md` die optionale Aufgabe „Bezahlfunktion umsetzen“. Ohne gewähltes Modell bleibt der Export unverändert. Die Monetarisierung blockiert den Export nie.
- Prompts `suggest-monetization-models` und `suggest-pricing-strategies` (Version 1) mit Golden Files. ADR 0011.
- Nutzerhandbuch und Architektur-Überblick um die Monetarisierung ergänzt.

### Geändert

- Typprüfung und Build nutzen TypeScript 7.0.2. ESLint bleibt über das offizielle TypeScript-6-Kompatibilitätspaket funktionsfähig; beide Compiler werden als getrennte Paket-Aliase installiert. `npm run typecheck` wählt TypeScript 7 ausdrücklich aus.

- Kernlogik für Varianten: Prompts `generate-variants` (ein bis drei Steckbriefe aus einer Idee) und `expand-profile` (Steckbrief zu zehn Abschnitten ausarbeiten), jeweils Version 1 mit Golden Files. Die Kostenanzeige nennt beide Aufgaben.
- Einstellungen: Neuer Abschnitt „Papierkorb“ mit der Aufbewahrungsfrist 1, 7 oder 30 Tage (Standard 1 Tag). Ein Hinweis nennt, für wie viele Einträge eine kürzere Frist sofort abläuft.
- Löschen legt ein Projekt in den Papierkorb, statt es sofort zu entfernen. Die Projektliste zeigt nur gespeicherte Projekte. Das Repository kann Einträge wiederherstellen, endgültig löschen und abgelaufene Einträge aus dem Papierkorb entfernen; gespeicherte Einträge löscht es dabei nie. Ansicht und Frist folgen in den nächsten Schritten.
- Datenformat auf Version 5: Neue Felder `project.profile` (Steckbrief, sonst `null`) und `project.library` (Bibliothek oder Papierkorb). Bestehende Projekte werden beim Laden migriert und stehen als gespeichert in der Bibliothek. ADR 0012.
- Datenformat auf Version 4: Neues Feld `project.monetization`, solange nicht begonnen `null`. Projekte im bisherigen Format (Version 3) werden beim Laden automatisch migriert. Der Reife-Check und das Exportformat (`EXPORT_VERSION` 1) bleiben unverändert.
- Entwicklungsabhängigkeiten aktualisiert: Playwright 1.64, jsdom 30, lint-staged 17, @types/node 26; GitHub Actions auf aktuelle Hauptversionen (checkout 7, upload-artifact 7, Pages-Actions). Ein vorinstalliertes Chromium lässt sich für E2E-Tests über `PLAYWRIGHT_CHROMIUM_EXECUTABLE` angeben.
- Der Release-Workflow lässt sich von Hand oder per API mit einer Version starten und legt Tag und GitHub-Release selbst an, auch für ältere Versionen. So kann Claude Releases aus dem Chat erstellen (`docs/release-prozess.md`).

### Behoben

- Sicherheit: Der Pages-Workflow veröffentlicht nur noch nach einem Push auf `main` in diesem Repository. Vorher hätte auch ein grüner Pull Request aus einem Fork mit Branch `main` die Seite überschreiben können. Von Hand startbar nur noch für `main`.
- Wurde ein Projekt nach einem fehlgeschlagenen Speichern umbenannt, kam beim nächsten Öffnen der alte Name zurück und überschrieb die Umbenennung. Gelöschte Projekte hinterlassen keinen ungespeicherten Stand mehr im Speicher.
- `BASE_PATH` ohne abschließenden Schrägstrich funktioniert jetzt.
- Der Monetarisierungs-E2E-Test wartet beim Wechsel des Farbschemas auf das Ende der Farbwechsel, bevor er den Kontrast prüft. So meldet er keine Fehler durch Zwischenfarben.
- Doku: `404.html` erzeugt der Pages-Workflow, nicht `npm run build`; veralteter Hinweis zum Golden-File-Befehl und fehlender Schritt in „Neuen Blueprint-Abschnitt hinzufügen“ korrigiert.

## [1.0.0] – 2026-10-11 – Phase 9: Release & Wartung

### Hinzugefügt

- Öffentliche Adresse: <https://lucaderg.github.io/blueprint-wizard/>. Nach jeder grünen CI auf `main` wird die App automatisch auf GitHub Pages veröffentlicht. Die App funktioniert dafür auch in einem Unterordner (`BASE_PATH`), inklusive Direktaufruf von Unterseiten, installierbarer App und Offline-Start.
- Release-Workflow: Ein Versions-Tag legt das GitHub-Release mit dem passenden CHANGELOG-Abschnitt an und prüft, ob die Version zu `package.json` passt.
- Dependabot hält npm-Pakete (wöchentlich, kleine Updates gebündelt) und GitHub Actions (monatlich) aktuell.
- Dokumentation: Nutzerhandbuch, Architektur-Überblick, Anleitung „Neuen Blueprint-Abschnitt hinzufügen“ und Release-/Update-Prozess. ADR 0010.

### Behoben

- Schlägt das Speichern fehl und man wechselt die Seite (z. B. zum Export), zeigt die nächste Seite jetzt den ungespeicherten Stand samt Fehlermeldung statt des älteren gespeicherten Stands. Gelingt das Speichern später, verschwindet der Hinweis.

## [0.8.0] – 2026-10-11 – Phase 8: Qualität & Politur

### Hinzugefügt

- Englische Oberfläche und Dunkelmodus, wählbar unter Einstellungen → Darstellung (Hell, Dunkel oder wie das System). Zahlen, Daten und Beträge folgen der gewählten Sprache. Die Einstellung greift schon vor dem ersten Rendern, ohne Aufflackern.
- Kostenanzeige: Oben rechts stehen die KI-Kosten der aktuellen Sitzung. Ein Klick zeigt die letzte Anfrage (Aufgabe, Tokens, Kosten, Modell) und die Summe; zurücksetzbar. Grundlage sind die Verbrauchsangaben von OpenRouter.
- Installierbar als App (PWA) mit eigenem Symbol; nach dem ersten Laden läuft die App auch offline. KI-Funktionen brauchen weiterhin Internet.
- Ladeanzeige und verständliche Fehlerseite, falls eine Seite nicht geladen werden kann.
- Automatische Barrierefreiheitsprüfung (axe) aller Seiten in hell und dunkel, Lighthouse-Prüfung in der CI (Mindestwert 90 in allen Kategorien), Test auf vollständige englische Übersetzung. ADR 0009.

### Geändert

- Seiten werden erst bei Bedarf geladen; der Start lädt deutlich weniger Code.
- Neues App-Symbol statt des Vite-Logos.

### Behoben

- Export: Antworten aus alten v1-Projekten (ohne Verlauf) fehlten in `BLUEPRINT.md`. Sie erscheinen jetzt, ohne Doppelungen.
- Export: Klappt das Kopieren des Start-Prompts nicht (auch ohne Zwischenablage-Zugriff), ist der Start-Prompt jetzt zuverlässig markiert.
- Startseite: Die Beschreibungen der Einstiegskacheln werden Screenreadern vorgelesen.

## [0.7.0] – 2026-10-11 – Phase 7: Blueprint-Generierung & Export

### Hinzugefügt

- „Blueprint fertigstellen“ auf der Projektseite mit Reife-Check, Dateivorschau und Download unter `/projekte/:projectId/export`. Offene Punkte werden angezeigt; Export ist trotzdem möglich, ohne Bestätigungsdialog und ohne API-Key.
- Reine Generatoren für `BLUEPRINT.md`, identische Kontextdateien `CLAUDE.md` und `AGENTS.md`, `TASKS.md` mit vorhandener Roadmap und Phasenvorlage samt Abnahmekriterien sowie `START-PROMPT.md` zum Kopieren.
- Blueprint bewahrt alle Abschnitte, getroffene Entscheidungen mit Begründung und Folgen, offene Entscheidungen samt Optionen und Empfehlung, Fragenverlauf, Vorschläge und frühere KI-Analyse. Nicht übernommene KI-Inhalte und offene Punkte bleiben klar gekennzeichnet.
- Einzeldatei-Download und lokales ZIP mit allen fünf UTF-8-Dateien über `fflate`; Vorschau und ZIP enthalten exakt denselben Stand. Keine Änderung am Projektformat (weiter Schema v3).
- Verständliche Fehlermeldungen für Download, Laden und Zwischenablage; bei Kopierfehlern steht der markierte Start-Prompt zur manuellen Übernahme bereit.
- Snapshot-, Vollständigkeits-, Reife-, ZIP- und Komponententests; E2E-Abnahme inklusive sofortigem Wechsel nach Bearbeitung, ZIP-Inhalten, Einzeldatei, Zwischenablage, Neuladen und importiertem Altprojekt. ADR 0008 und Übergabe für Phase 8.

### Behoben

- Der bestehende Fragenmotor-E2E-Test wartet vor dem Neuladen auf die tatsächlich gerenderte Projektseite. Der Vorher/Nachher-Vergleich auf der vorherigen Seite hat denselben Artikelnamen und konnte sonst zu früh als Projektansicht gelten.

## [0.6.0] – 2026-10-11 – Phase 6: Ideenfindung von Null

### Hinzugefügt

- Einstieg „Ich habe keine Idee“ mit kurzem Fragebogen auf einer Seite: Interessen und Fähigkeiten als antippbare Vorschläge oder eigene Schlagwörter, Frust im Alltag, Lernziel, verfügbare Zeit und Plattform. Alles ist freiwillig; Interessen, ein Ärgernis oder ein Lernziel reichen für den Start.
- Die KI schlägt vier Ideen vor, jeweils mit Kurzbeschreibung, Kernfunktionen, Aufwand, Neuheit und Lernwert. Ideen lassen sich einfacher oder ehrgeiziger machen, nach eigenem Wunsch abwandeln, „Mehr wie diese“ anfordern, zu zweit kombinieren oder neu würfeln (ohne Wiederholungen).
- „Diese Idee nehmen“ legt direkt ein Projekt an: Problem, Zielgruppe, Kernfunktionen und Tech-Stack sind gefüllt und als übernommener KI-Inhalt markiert, weiter geht es im normalen Wizard.
- Der Stand der Ideenfindung bleibt beim Neuladen erhalten (nur im aktuellen Tab).
- Prompt `generate-ideas` (Version 1) mit Golden Files, Kernlogik in `src/core/ideation` und `src/core/engine/ideation.ts`, ADR 0007.
- Ohne Key: „Ohne KI starten“ legt ein leeres Projekt an, Ärgernisse und Interessen landen als eigener Text in „Problem & Vision“.

## [0.5.1] – 2026-10-11 – Reibungsloserer Fragen-Ablauf

### Geändert

- Die Fragen-Seite zeigt alle offenen Fragen (bis zu 8) auf einmal. Man beantwortet, was man weiß, und übernimmt alles mit einem Klick auf „Antworten übernehmen“ (oder Strg/Cmd + Enter). Unbeantwortete Fragen bleiben stehen, „Später“ ist ein Schalter direkt an der Frage.
- Die KI arbeitet die Antworten danach direkt in den Blueprint ein, ohne Bestätigung pro Abschnitt. Eine kurze Zusammenfassung nennt die geänderten Abschnitte, mit „Änderungen ansehen“ (Vorher/Nachher) und „Zurücknehmen“. Nur Änderungen, die einen Abschnitt stark kürzen, warten auf Bestätigung.
- Die Analyse startet beim ersten Öffnen automatisch und läuft erneut, sobald alle Fragen beantwortet sind. Folgefragen erscheinen dadurch ohne zusätzlichen Klick.
- Rundengröße von 3 auf 8 Fragen erhöht.

### Hinzugefügt

- `revertIntegration` im Kern nimmt eingearbeitete Änderungen zurück, solange der Abschnitt seitdem nicht weiter bearbeitet wurde.

## [0.5.0] – 2026-10-11 – Phase 5: Entscheidungen & Vorschläge

### Hinzugefügt

- Seite „Entscheidungen & Vorschläge“ unter `/projekte/:projectId/entscheidungen`. Der Abschnitt „Wichtigste Entscheidungen“ zeigt bis zu 7 Kernentscheidungen, sortiert nach Hebel × Unsicherheit des Abschnitts. Jede Entscheidung hat 2–4 Optionen mit Vor- und Nachteilen, die Folge der Wahl und eine Empfehlung.
- Entscheiden mit Begründung, Verwerfen und Wieder öffnen. Die KI ermittelt die Entscheidungen über den Prompt `identify-decisions` (Version 1) und das Zod-Schema der Entscheidungen.
- Entscheidungsprotokoll mit den getroffenen Entscheiden in zeitlicher Reihenfolge, auf der Entscheidungsseite und auf der Projektseite.
- Vorschlagsmodus: Der Prompt `suggest-additions` (Version 1) schlägt Kernfunktionen, Nicht-Ziele und Risiken vor, höchstens vier je Abschnitt. Vorschläge lassen sich einzeln annehmen oder ablehnen. Angenommene Vorschläge werden als Stichpunkt an den Abschnitt angehängt, vorhandener Inhalt bleibt unverändert.
- Regelbasierte Widerspruchswarnungen mit Fundstellen in den Abschnitten und gewählten Optionen. Zusätzlich werden die Widersprüche aus der KI-Analyse angezeigt. Auf der Projektseite zeigt ein Zähler die Widersprüche an.
- ADR 0006 zu Entscheidungen, Vorschlägen und Widerspruchswarnungen.
- Tests: 1047 Unit- und Komponententests in 57 Dateien, alle grün. Neu sind Tests für Schema, Migration v2 → v3 (Fixture `src/core/blueprint/__fixtures__/project-v2.json`, Kette v1 → v3), Rangfolge, Annehmen und Ablehnen, Widerspruchsregeln mit positiven und negativen Beispielen sowie Golden Files für beide Prompts. E2E-Tests: 19, davon 2 neu in `e2e/decisions.spec.ts` („Vorschlag annehmen → erscheint im Blueprint“, „Entscheidung treffen → Protokoll, Widerspruch wird angezeigt“).

### Geändert

- Datenformat auf Version 3: Entscheidungen liegen projektweit unter `decisions` statt pro Abschnitt, neu ist die Liste `additions` für Vorschläge. Projekte aus v0.4.x werden beim Laden automatisch migriert. Alte Entscheidungen, die sich nicht übernehmen lassen, werden verworfen, statt das Projekt zu sperren.
- Der Fragenmotor kürzt zu viele KI-Fragen jetzt nach Hebel statt nach Position.

### Behoben

- Widerspruchsregeln meldeten Fehlalarme bei Formulierungen wie „Freemium“, „Login ist nicht erforderlich“, „ohne den lästigen Login“, „entfällt“ und bei zeitlicher Staffelung wie „App-Store in Phase 2“.
- Altdaten mit nur einer Option oder ohne gewählte Option sperren das Projekt nicht mehr.
- Aufzählungszeichen in KI-Vorschlägen führten zu „- - Text“. Sie werden jetzt entfernt.
- Klicks auf veraltete IDs (z. B. nach einer neuen Ermittlung) führen nicht mehr zu Fehlern.
- Fundstellen der Widersprüche werden in einem eigenen Abschnitt angezeigt.

## [0.4.0] – 2026-10-11 – Phase 4: Intelligenter Fragenmotor

### Hinzugefügt

- Fragen-Seite `/projekte/:projectId/fragen` mit Lückenanalyse: Zusammenfassung, Lücken und Widersprüche, jeweils mit den betroffenen Abschnitten. Die Analyse läuft über den Prompt `analyze-blueprint` (Version 1) und das Zod-Schema `blueprintAnalysisResultSchema`.
- Fragerunden mit 1–3 Fragen. Jede Frage lässt sich per Antwortoption, Freitext oder „Später“ beantworten. Die Begründung und der Hebel jeder Frage werden angezeigt.
- Deterministische Priorisierung in `src/core/engine/prioritization.ts`: Score aus Hebel, Unsicherheit des Abschnitts (Reifegrad) und Abhängigkeitsfaktor. Grundsatzfragen (Plattform, Zielgruppe, MVP-Umfang) kommen vor Detailfragen. Fragen mit offener Abhängigkeit oder leerer Voraussetzung werden zurückgestellt, „Später“-Fragen kommen wieder, wenn nichts anderes offen ist.
- Einarbeiten der Antworten einer Runde: Der Prompt `integrate-answers` (Version 1) formuliert die betroffenen Abschnitte neu. Vorher und Nachher werden gegenübergestellt, übernommen wird erst nach Bestätigung. Bei deutlichem Kürzen eines Abschnitts erscheint eine Warnung.
- Wörtliches Anhängen der Antworten als Stichpunkte, ohne KI. Das ist der Fallback, wenn die KI nicht erreichbar ist oder die Vorschläge verworfen werden.
- Verlauf der Fragen: Welche Frage wann und mit welcher Antwort beantwortet oder zurückgestellt wurde.
- Link „Fragen beantworten“ mit Zähler offener Fragen auf der Projektseite.
- Tests: Tabellen-Tests für die Priorisierung, Logik für Antworten und Abhängigkeiten, Golden Files für beide Prompts sowie ein Abnahmetest mit gespeicherter KI-Antwort ohne Netzwerk. E2E-Test in `e2e/interview.spec.ts`.
- ADR 0005 zum Fragenmotor.

### Geändert

- Datenformat auf Version 2: Fragen liegen projektweit unter `interview` (`questions`, `log`, `analysis`) statt pro Abschnitt. Projekte aus v0.3.x werden beim Laden automatisch migriert, alte Fragen erhalten ihren Abschnitt als `sectionId`.

### Behoben

- Nach schnellem Seitenwechsel zeigte die neue Seite kurz den Stand vor dem letzten Speichern; Seiten warten jetzt
  auf laufende Speichervorgänge.

## [0.3.1] – Fehlerbehebung KI-Anfragen

### Behoben

- „Das gewählte Modell ist gerade nicht verfügbar“ erschien bei jedem Modell, weil die App Anbieter mit Unterstützung für strukturierte Antworten erzwungen hat (`require_parameters`). Der Zwang ist entfernt.

### Hinzugefügt

- Lehnt OpenRouter eine Anfrage mit Antwortschema ab (400/404), versucht die App es einmal ohne Schemazwang, mit dem Schema im Prompt. Die Antwort wird weiterhin per Zod geprüft.
- Fehlermeldungen zeigen zusätzlich die Originalmeldung von OpenRouter („Technische Details“).

## [0.3.0] – Phase 3: Wizard-Gerüst & Einstiegspunkte

### Hinzugefügt

- Einstiegspunkte `/neu/keine-idee`, `/neu/teil-idee` und `/neu/fast-fertig` mit Erklärung, Hinweis zum API-Key, Projektnamen und Freitextfeld.
- Freitext als `.txt`- oder `.md`-Datei hochladen (beim Einstieg „fast fertig“).
- „Idee einordnen“: Die KI verteilt den Text auf die zehn Blueprint-Abschnitte und schlägt Reifegrad, Projektnamen und Kurzfassung vor. Der Prompt `classify-idea` (Version 1) liegt versioniert in `src/core/ai/prompts/`, die Antwort ist ein Zod-Schema (`classificationSchema`) über `generateStructured`. Maximal 20.000 Zeichen.
- Ohne KI starten: Legt ein leeres Projekt an. Ein eingegebener Text bleibt als eigener Inhalt im Abschnitt „Problem & Vision“ erhalten.
- Ein Projekt entsteht erst nach einer erfolgreichen KI-Antwort, Abbrechen ist möglich. Bei Fehlern entstehen keine leeren Projekte.
- Blueprint-Übersicht auf der Projektseite mit bearbeitbaren Abschnitten, Reifegrad und Herkunft des Inhalts (eigener Inhalt, KI-Vorschlag, bestätigt).
- KI-Vorschläge lassen sich pro Abschnitt übernehmen; eigener Inhalt wird von der KI nie überschrieben.
- Rückgängig und Wiederholen über Schaltflächen sowie Strg/Cmd+Z, Strg/Cmd+Umschalt+Z und Strg+Y (bis zu 50 Schritte pro Seitenbesuch).
- Automatisches Speichern 600 ms nach der letzten Änderung, mit Speicherstatus. Ausstehende Änderungen werden beim Verlassen der Seite und beim direkten Wechsel zwischen zwei Projekten gespeichert.
- Änderungen an Abschnitten als reine Funktionen (`src/core/blueprint/editing.ts`) und Verlauf (`history.ts`), jeweils mit Tests.
- ADR 0004 zu Einordnung und Bearbeitung.

### Geändert

- Die Startseite zeigt die drei Einstiegspunkte als aktive Auswahl.
- Standardmodell ist jetzt `anthropic/claude-haiku-5.5` (vorher `anthropic/claude-sonnet-5.5`). Bereits gespeicherte Einstellungen bleiben unverändert.

## [0.2.0] – Phase 2: Einstellungen & OpenRouter-Anbindung

### Hinzugefügt

- KI-Schnittstelle `AiProvider` mit `OpenRouterProvider` (Antworten und Streaming) und `MockAiProvider` für Tests.
- Einheitliche KI-Fehler (`AiError`) für ungültigen Key, fehlendes Guthaben, Rate-Limit, Timeout, Netzwerk, nicht verfügbares Modell, Fehler mitten im Stream und mehr.
- Strukturierte Antworten: Zod-Schema → JSON-Schema, Validierung und genau ein automatischer Reparaturversuch (`generateStructured`).
- Key-Prüfung und Modellliste über die OpenRouter-API; Standardmodell `anthropic/claude-sonnet-5.5`.
- Einstellungsspeicher in `localStorage` mit Rückfall auf Standardwerte pro Feld.
- Einstellungsseite mit OpenRouter-API-Key (anzeigen/verbergen, speichern, „Verbindung testen“ mit Guthaben-Anzeige, „Key löschen“ mit Bestätigung).
- Modellauswahl mit Textfilter, Filter für strukturierte Antworten, Preisen pro Million Tokens und manueller Modell-ID bei Ladefehler.
- Einstellungen für Temperatur und Antwortsprache.
- Hinweis auf der Startseite, solange kein API-Key hinterlegt ist.
- Zuordnung aller KI-Fehlercodes zu deutschen Meldungen (`ai.errors.*`).
- E2E-Tests für die Einstellungen; OpenRouter wird dort per `page.route` gemockt.
- ADR 0003 zur KI-Anbindung.

## [0.1.0] – Phase 1: Datenmodell & Speicherung

### Hinzugefügt

- Blueprint-Datenmodell als Zod-Schemas: Projekt, Blueprint mit 10 festen Abschnitten, Reifegrad (leer/vage/entschieden), Entscheidungen mit Optionen und Hebel, Fragen.
- Gewichteter Vollständigkeits-Score pro Abschnitt und gesamt.
- Versioniertes Projektformat mit Migrationssystem (`schemaVersion`, `migrateProject`).
- JSON-Exportformat mit Formatkennung; Import migriert ältere Dateien und vergibt immer eine neue ID.
- `ProjectRepository`-Schnittstelle mit IndexedDB-Implementierung (Dexie) und Memory-Implementierung für Tests, geprüft durch eine gemeinsame Vertrags-Testsuite.
- Projektliste auf der Startseite: anlegen, umbenennen, duplizieren, löschen (mit Bestätigung), exportieren, importieren.
- Projektseite mit allen Abschnitten, Reifegrad und Fortschrittsbalken.
- Barrierearmer Dialog, Download-Helfer, Slugify- und Format-Helfer.
- E2E-Abnahmetest: Projekt anlegen, Seite neu laden, Projekt ist noch da; dazu Tests für Umbenennen, Duplizieren, Löschen und Export/Import.
- ADR 0002 zu Datenmodell und Speicherung.

### Geändert

- Abdeckungs-Mindestwert für `src/core/**`: 80 % Zeilen und Zweige.
- Build teilt Bibliotheken in eigene Chunks (`react`, `vendor`), damit keine Datei über 500 kB liegt.

## [0.0.1] – Phase 0: Fundament

### Hinzugefügt

- Projektgerüst mit Vite 8, React 19 und TypeScript im Strict-Modus, Pfad-Alias `@/` für `src/`.
- Ordnerstruktur `src/app`, `src/features`, `src/core`, `src/shared`, `src/test`, `e2e`.
- Tailwind CSS v4 und shadcn/ui-Konfiguration (`components.json`), erste Komponente `Button` und Helfer `cn`.
- React Router mit Layout, Startseite (drei Einstiegspunkte), Einstellungsseite (Platzhalter) und 404-Seite.
- i18next mit deutschen Texten in `src/shared/i18n/locales/de.json` und typisierten Keys.
- Zustand als Abhängigkeit für späteres State-Management.
- ESLint (inkl. Regel: `src/core` darf kein React und keine UI-Schichten importieren) und Prettier mit Tailwind-Plugin.
- Husky-Pre-Commit-Hook mit lint-staged.
- Vitest mit jsdom, Testing Library und Abdeckungsbericht (Mindestwert 70 % Zeilen).
- MSW-Testserver, der nicht gemockte Netzwerkaufrufe als Fehler behandelt.
- Smoke-Tests: Komponententests für Startseite, Navigation und 404-Seite; Playwright-E2E-Test „App startet und zeigt die Startseite“.
- GitHub-Actions-Workflow: Lint → Typcheck → Unit-Tests → Build → E2E.
- Dokumentation: `README.md`, `CLAUDE.md`, `CHANGELOG.md`, Implementierungsplan und ADRs in `docs/adr/` (Vorlage, ADR 0001 zum Tech-Stack).
