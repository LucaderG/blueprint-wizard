# ADR 0008: Deterministischer Blueprint-Export ohne KI-Aufruf

- **Status:** Angenommen
- **Datum:** 2026-10-11
- **Phase:** Phase 7

## Kontext

Der ausgearbeitete Blueprint soll ein KI-Coding-Tool in einem leeren Repository starten können. Dateien müssen den vorhandenen Projektstand verlässlich bewahren. Unvollständige Blueprints sollen sich ebenfalls exportieren lassen, ohne neue Bestätigungsrunden oder zusätzliche KI-Kosten. Phase 7 verlangt reine Generatoren, Dateivorschau, Start-Prompt und ZIP.

## Entscheidung

`src/core/export` erzeugt alle Dateien deterministisch aus `Project` und übergebenen `ExportLabels`. Die Texte kommen in der Oberfläche aus i18next; der Kern kennt weder React noch i18next. Es gibt keinen KI-Aufruf und keine Änderung am Projekt oder seinem v3-Schema. Eine separate Exportversion kennzeichnet das Dateiformat.

Das Paket enthält `BLUEPRINT.md`, `CLAUDE.md`, `AGENTS.md`, `TASKS.md` und `START-PROMPT.md`. Beide Kontextdateien sind identisch. Bestehende Abschnittsinhalte und Roadmap bleiben erhalten. Aufgaben und Abnahmekriterien ergänzen eine ausdrücklich als Vorlage gekennzeichnete Phasenliste; die gespeicherte Projekt-Roadmap hat Vorrang. Noch fehlende Anforderungen werden nicht erfunden.

Der Reife-Check zeigt leere/vage Abschnitte, nicht übernommene KI-Inhalte, offene/zurückgestellte Fragen, offene Entscheidungen und Ergänzungen, regelbasierte Widersprüche sowie Lücken/Widersprüche aus früheren KI-Analysen. Letztere sind als möglicherweise überholt gekennzeichnet. Hinweise werden im Paket bewahrt und blockieren keinen Download.

ZIPs entstehen mit `fflate` (MIT, Browser-Unterstützung und TypeScript-Typen), UTF-8, festen Dateinamen und festen Zeitstempeln. Für die fünf kleinen Textdateien nutzen wir `zipSync` ohne Worker. Dieselben erzeugten Dateien speisen Vorschau und Downloads. Die Vorschau ist ein schreibgeschütztes Textfeld, sodass Projektinhalt als Text sichtbar bleibt.

Quelle zur Bibliothek: [fflate-Dokumentation](https://github.com/101arrowz/fflate).

## Konsequenzen

- Exporte funktionieren offline und ohne API-Key. App-Einstellungen werden nicht eingelesen oder exportiert.
- Snapshot-Tests prüfen das Format, ZIP-Tests die vollständigen UTF-8-Inhalte. E2E prüft die Übereinstimmung mit der Vorschau und dass ausstehende Autosaves vor dem Laden abgewartet werden.
- Eine Vorlage kann keinen vollständig projektspezifischen Umsetzungsplan aus beliebigem Freitext ableiten. Das Coding-Tool muss sie mit der vorhandenen Roadmap abgleichen und ungeklärte Anforderungen besprechen.
- Bei sehr großen Projekten ist die synchrone ZIP-Erzeugung im Refactoring-/Performance-Fenster von Phase 8 erneut zu prüfen.

## Erwogene Alternativen

- **KI-generierte Exportdateien:** zusätzliche Kosten, Netzwerkabhängigkeit und Risiko veränderter Anforderungen. Für den zuverlässigen Export nicht erforderlich.
- **JSZip:** möglich, aber `fflate` deckt die fünf Textdateien mit kleinerem Funktionsumfang für unseren Bedarf ab.
- **Nur CLAUDE.md oder nur AGENTS.md:** beide sind für den Start mit verschiedenen Coding-Tools nützlich und können ohne widersprüchliche Regeln erzeugt werden.
- **Export erst nach 100 % Reife:** verhindert frühes Ausprobieren und würde einen weiteren Bestätigungsschritt erzwingen.
