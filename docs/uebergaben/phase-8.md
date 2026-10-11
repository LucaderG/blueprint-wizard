# Übergabe nach Phase 8 – Qualität & Politur

Stand: 2026-10-11, v0.8.0. Ausgangspunkt: `2c92816` (v0.7.0, Phase 7 von einem anderen Tool umgesetzt).

## Gebaut

- Review-Befunde aus Phase 7 behoben: Antworten aus v1-Projekten fehlen nicht mehr im Export (`interviewEntries`), Start-Prompt wird nach Kopierfehler zuverlässig markiert (auch ohne Clipboard-API). Beide mit Regressionstests.
- Einstellungen → Darstellung: Oberflächensprache Deutsch/Englisch, Farbschema System/Hell/Dunkel. Vollständige englische Übersetzung, sprachabhängige Zahlen-/Datumsformate.
- Kostenanzeige der Sitzung oben rechts (letzte Anfrage und Summe, zurücksetzbar) auf Basis der OpenRouter-Verbrauchsangaben.
- PWA: Manifest, Symbole, Service Worker, Offline-Start. Neues App-Symbol.
- Lazy-Routen mit Ladeanzeige und Fehlerseite; Startseite lädt deutlich weniger Code.
- axe-Prüfung aller Seiten (hell/dunkel) in E2E, Lighthouse CI als eigener Job. ADR 0009.

## Prüfungen

- `npm run check` grün (Lint, Format, Typcheck, über 1.300 Tests mit Abdeckungsprüfung).
- `npm run test:e2e` grün, einschließlich 24 axe-Tests und PWA-Offline-Test.
- Lighthouse lokal: Startseite 100/100/100/100, Einstellungen 100/100/96/100 (Best Practices durch die gesperrte Modellliste in der Sandbox).

Screenshots:

- [Einstellungen dunkel](../screenshots/phase-8-einstellungen-dunkel.png)
- [Kostenanzeige dunkel](../screenshots/phase-8-kosten-dunkel.png)
- [Englische Oberfläche](../screenshots/phase-8-englisch.png)
- [Mobil, 390 px](../screenshots/phase-8-mobil.png)

## Offen

- Lucas Test mit echtem Key: Kostenanzeige nach einer Fragenrunde, Dunkelmodus, Englisch, App installieren.
- Bekannte Beobachtung aus dem Phase-7-Review, nicht behoben: Schlägt das Speichern dauerhaft fehl, erlaubt ein Seitenwechsel (z. B. zum Export) das Weiternavigieren und lädt danach den älteren gespeicherten Stand. Betrifft `useProjectEditor`/`pendingSaves`; Vorschlag: Navigation an bestätigtes Speichern knüpfen.
- Der Hinweis „Strg + Enter“ lautet auch auf macOS so (dort funktioniert Cmd + Enter ebenfalls).
- GitHub-Release/Tag `v0.8.0` legt Luca selbst an.

## Nächster Schritt: Phase 9 – Release & Wartung

Zuerst den offenen Speicher-/Navigationsfall entscheiden und beheben, dann laut Plan die Release-Schritte.
