# ADR 0010: Hosting auf GitHub Pages, Release-Ablauf und Abhängigkeits-Updates

- **Status:** Angenommen
- **Datum:** 2026-10-11
- **Phase:** Phase 9

## Kontext

Phase 9 verlangt eine öffentliche, rein statische Bereitstellung, semantische Versionierung mit Release-Ablauf und automatische Abhängigkeits-Updates. Im Plan (Entscheidung 6) ist GitHub Pages vorgeschlagen und von Luca bestätigt. Die App hat keinen Server; Projekte und API-Key bleiben im Browser.

## Entscheidung

- **GitHub Pages** unter `https://lucaderg.github.io/blueprint-wizard/`. Die App liegt damit in einem Unterordner. Vite liest dafür `BASE_PATH` (Standard `/`), der Router nutzt `import.meta.env.BASE_URL` als `basename`, Manifest und Service Worker leiten Scope und Fallback daraus ab. Lokal und in allen Tests bleibt die App unter `/`.
- **SPA-Routing auf Pages:** Der Pages-Workflow kopiert nach dem Build `index.html` nach `404.html`, damit direkt aufgerufene Unterseiten laden. Nach dem ersten Besuch übernimmt der Service Worker das Routing.
- **Veröffentlichen nach grüner CI:** `pages.yml` startet per `workflow_run`, sobald die CI auf `main` erfolgreich war, und baut genau diesen Commit. So geht nichts online, was Tests nicht bestanden hat, und es braucht keine Tag-Regeln für die `github-pages`-Umgebung.
- **Releases über Tags:** `release.yml` reagiert auf `v*.*.*`-Tags, prüft die Übereinstimmung mit `package.json` und legt das GitHub-Release mit dem CHANGELOG-Abschnitt an. Ein in der Oberfläche angelegtes Release bleibt unverändert.
- **Dependabot** statt Renovate: in GitHub eingebaut, keine App-Installation nötig. Minor/Patch-Updates gebündelt, Major einzeln, Actions monatlich.

## Konsequenzen

- Einmalig muss im Repository „Settings → Pages → Source: GitHub Actions“ gesetzt werden; vorher schlägt der Pages-Workflow fehl.
- Die öffentliche Seite zeigt immer den letzten grünen Stand von `main`. Releases markieren Versionen, steuern aber nicht die Bereitstellung.
- Jede Origin hat eigenen Browser-Speicher: Projekte aus `localhost` erscheinen nicht automatisch auf der Pages-Adresse (Export/Import der Projekte nutzen).
- Absolute Pfade im Code (`href="/..."`) sind tabu; Links laufen über den Router, Assets über Vite.

## Erwogene Alternativen

- **Netlify oder Vercel:** gleichwertig statisch, aber ein zusätzliches Konto. Mit `BASE_PATH` und SPA-Fallback weiter möglich.
- **Bereitstellung nur bei Release-Tags:** hätte Tag-Freigaben in der Pages-Umgebung erfordert und neue Fehlerbehebungen bis zum nächsten Tag zurückgehalten.
- **Hash-Routing statt `404.html`:** sicher auf jedem Host, aber hässliche URLs und Bruch mit bestehenden Links.
- **Tauri-Desktop-Build (im Plan optional):** zurückgestellt. Die installierbare PWA deckt Offline-Nutzung und App-Fenster ab; Tauri lässt sich ohne Umbau später ergänzen.
