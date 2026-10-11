# Release- und Update-Prozess

Blueprint-Wizard folgt [Semantic Versioning](https://semver.org/lang/de/): `MAJOR.MINOR.PATCH`.

- **PATCH** (1.0.1): Fehlerbehebung ohne neue Funktion.
- **MINOR** (1.1.0): neue Funktion, alte Projekte und Einstellungen laden weiter.
- **MAJOR** (2.0.0): Änderung, bei der Nutzer etwas tun müssen (z. B. Daten neu importieren).

Eine Schemaänderung mit Migration (siehe `CLAUDE.md`) ist kein Grund für MAJOR, solange die Migration alte Projekte automatisch übernimmt.

## Wo die App läuft

- **Öffentlich:** <https://lucaderg.github.io/blueprint-wizard/>. Der Workflow `.github/workflows/pages.yml` baut nach jeder grünen CI auf `main` neu und veröffentlicht. Er lässt sich unter Actions → „GitHub Pages“ → „Run workflow“ auch von Hand starten.
- **Einmalige Einrichtung:** Im Repository unter Settings → Pages bei „Source“ den Eintrag „GitHub Actions“ wählen. Ohne diese Einstellung schlägt der Pages-Workflow fehl.
- **Lokal:** `npm install`, dann `npm run dev` (oder `npm run build && npm run preview`).

Die App ist rein statisch. Für einen anderen Hoster (Netlify, Vercel, eigener Server) reicht `npm run build`; liegt die App dort in einem Unterordner, beim Build `BASE_PATH=/unterordner/` setzen. Unbekannte Pfade müssen auf `index.html` zeigen (SPA).

## Ein Release veröffentlichen

1. Alle Änderungen sind auf `main`, die CI ist grün.
2. In `CHANGELOG.md` den Abschnitt `[Unreleased]` in `[X.Y.Z] – JJJJ-MM-TT – Titel` umbenennen und darüber einen leeren `[Unreleased]` anlegen.
3. Version setzen: `npm pkg set version=X.Y.Z && npm install --package-lock-only`.
4. Prüfen: `npm run check` und `npm run test:e2e`.
5. Commit `chore: Release vX.Y.Z` auf `main` pushen. Nach grüner CI veröffentlicht der Pages-Workflow die neue Version.
6. Tag setzen, auf einem von zwei Wegen:
   - **Per Git:** `git tag vX.Y.Z && git push origin vX.Y.Z`. Der Workflow `release.yml` prüft, ob Tag und `package.json` zusammenpassen, und legt das GitHub-Release mit dem CHANGELOG-Abschnitt als Text an.
   - **In der GitHub-Oberfläche:** Releases → „Draft a new release“ → Tag `vX.Y.Z` auf `main` anlegen, den CHANGELOG-Abschnitt als Beschreibung einfügen, veröffentlichen.

Installierte Apps (PWA) laden die neue Version beim nächsten Öffnen automatisch (`registerType: 'autoUpdate'`).

## Abhängigkeiten aktuell halten

Dependabot (`.github/dependabot.yml`) öffnet montags Pull Requests:

- **Kleine Updates** (minor/patch) kommen gebündelt in einem PR. Ist die CI grün, kann er gemergt werden.
- **Große Updates** (major) kommen einzeln. Vor dem Mergen den Changelog der Bibliothek lesen, lokal `npm run check` und `npm run test:e2e` laufen lassen und die App kurz von Hand ausprobieren.
- **GitHub Actions** werden monatlich aktualisiert.

Abhängigkeits-Updates allein brauchen kein eigenes Release. Sie gehen mit dem nächsten Release raus, außer bei Sicherheitsupdates: dann ein PATCH-Release.

## Wenn etwas schiefgeht

- **Pages-Workflow rot:** Ist unter Settings → Pages „GitHub Actions“ gewählt? Sonst das Log des Schritts lesen. Die zuletzt veröffentlichte Version bleibt so lange online.
- **Fehlerhafte Version veröffentlicht:** Den Fehler-Commit auf `main` per `git revert` zurücknehmen und pushen. Nach grüner CI ist die vorige Fassung wieder online. Danach ein PATCH-Release.
- **Release-Workflow rot wegen Versionsnummer:** Tag löschen (`git push --delete origin vX.Y.Z`), Version in `package.json` korrigieren, neu taggen.
