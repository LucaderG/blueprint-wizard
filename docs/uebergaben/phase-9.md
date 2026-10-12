# Übergabe nach Phase 9 – Release & Wartung

Stand: 2026-10-11, v1.0.0. Ausgangspunkt: `7ec3a79` (v0.8.0). Damit ist der Implementierungsplan vollständig umgesetzt.

## Gebaut

- **Offener Punkt aus Phase 7/8 behoben:** Scheitert das Speichern und man wechselt die Seite, übernimmt die nächste Seite den ungespeicherten Stand samt Fehlermeldung (`rememberUnsaved` in `pendingSaves.ts`). Regressionstest in `useProjectEditor.test.tsx`, vorher rot.
- **GitHub Pages:** `pages.yml` veröffentlicht nach grüner CI auf `main`. Die App läuft im Unterordner (`BASE_PATH`, Router-`basename`, Manifest-Scope, Service-Worker-Fallback, `404.html`).
- **Release-Workflow:** `release.yml` legt bei einem `v*.*.*`-Tag das GitHub-Release aus dem CHANGELOG an und prüft die Version.
- **Dependabot** für npm (wöchentlich, gebündelt) und GitHub Actions (monatlich).
- **Dokumentation:** Nutzerhandbuch, Architektur-Überblick, „Neuen Blueprint-Abschnitt hinzufügen“, Release-/Update-Prozess, ADR 0010.
- Tauri-Desktop-Build (optional im Plan) bewusst zurückgestellt, Begründung in ADR 0010.

## Prüfungen

- `npm run check` und `npm run test:e2e` grün.
- Pages-Build mit `BASE_PATH=/blueprint-wizard/` lokal im Browser geprüft: Startseite, Navigation, Direktaufruf und Neuladen von `/blueprint-wizard/einstellungen`, Service-Worker-Scope, Manifest, Offline-Start, keine Konsolenfehler.
- Datenkompatibilität: kein Schemawechsel (weiter v3), Einstellungen unverändert. Projekte aus v0.8.0 laden unverändert.

## Offen für Luca

- **Einmalig GitHub Pages einschalten:** Repository → Settings → Pages → Source „GitHub Actions“. Danach unter Actions → „GitHub Pages“ → „Run workflow“ starten (oder auf den nächsten Push warten). Die Adresse ist dann https://lucaderg.github.io/blueprint-wizard/.
- **Release v1.0.0** anlegen (Tags lassen sich aus der Cloud-Umgebung nicht pushen). Auf GitHub liegen nur v0.2.0 bis v0.5.0; v0.0.1, v0.1.0 und v0.6.0 bis v0.8.0 fehlen. Nachholen ist optional.
- Projekte, die lokal unter `localhost` liegen, erscheinen nicht automatisch auf der Pages-Adresse: über „Exportieren“/„Projekt importieren“ umziehen.
- Test mit echtem Key auf der öffentlichen Adresse.

## Bekannte Kleinigkeiten

- Der Hinweis „Strg + Enter“ lautet auch auf macOS so (Cmd + Enter funktioniert dort ebenfalls).
- Ungespeicherte Stände nach Speicherfehlern leben nur im Arbeitsspeicher; schließt man den Tab, sind sie weg (wie vorher).

## Wie es weitergeht

Weiterentwicklung nach `docs/release-prozess.md`. Ideen für später stehen im Plan („Spätere Ideen“) und in Lucas Feature-Liste.
