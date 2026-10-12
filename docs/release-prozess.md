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
6. Tag und GitHub-Release anlegen, auf einem von drei Wegen. Alle nutzen den Workflow `release.yml`: Er prüft, ob Tag und `package.json` zusammenpassen, und legt das Release mit dem CHANGELOG-Abschnitt als Text an.
   - **Per Chat mit Claude (empfohlen):** „Mach Release X.Y.Z“ schreiben (siehe unten).
   - **In der GitHub-Oberfläche:** Actions → „Release“ → „Run workflow“, Version `X.Y.Z` eintragen.
   - **Per Git:** `git tag vX.Y.Z && git push origin vX.Y.Z`.

Ohne Angabe eines Commits setzt der Workflow den Tag auf den ersten Commit auf `main`, dessen `package.json` die Version trägt, also auf den Release-Commit. Als „Latest“ markiert er nur die höchste Version; nachgeholte ältere Releases ändern das nicht. Gibt es das Release schon, passiert nichts.

### Releases per Chat an Claude delegieren

Claude kann aus der Cloud keine Tags pushen, den Workflow aber über die GitHub-Verbindung starten. Im Projekt-Chat genügt:

- **„Mach Release 1.1.0“:** Claude führt die Schritte 2 bis 5 als Pull Request aus (CHANGELOG, Version, Prüfungen). Nach dem Mergen startet Claude den Release-Workflow und meldet den Link zum Release.
- **„Mach das Release für 1.1.0“, wenn die Version schon auf `main` ist:** Claude startet nur den Workflow.
- **„Sind die Releases aktuell?“:** Claude vergleicht Tags und Releases mit `package.json` auf `main` und den Versionen im CHANGELOG und holt fehlende nach Rückfrage nach.

Releases sind öffentlich. Claude legt sie nur an, wenn Luca es im Chat sagt.

### Versionsanzeige: stable oder nightly

Unten in der App steht die Version, z. B. „Version v1.0.0 · stable“. „stable“ erscheint nur, wenn der gebaute Commit den Release-Tag `vX.Y.Z` der Version aus `package.json` trägt. Alles andere, also Pull Requests, lokale Checkouts und Commits nach dem letzten Release, zeigt „nightly“ mit kurzem Commit-Hash, z. B. „Version v1.0.0 · nightly · abc1234“. Ohne git zeigt die App ebenfalls „nightly“. Bestimmt wird das beim Build in `vite.config.ts`; der Pages-Workflow holt dafür die Tags mit (`fetch-depth: 0`).

Weil der Pages-Workflow vor dem Tag läuft, startet `release.yml` ihn nach einem neuen „Latest“-Release noch einmal. Danach zeigt die öffentliche Seite „stable“.

Installierte Apps (PWA) laden die neue Version beim nächsten Öffnen automatisch (`registerType: 'autoUpdate'`).

## Abhängigkeiten aktuell halten

Dependabot (`.github/dependabot.yml`) öffnet montags Pull Requests:

- **Kleine Updates** (minor/patch) kommen gebündelt in einem PR. Ist die CI grün, kann er gemergt werden.
- **Große Updates** (major) kommen einzeln. Vor dem Mergen den Changelog der Bibliothek lesen, lokal `npm run check` und `npm run test:e2e` laufen lassen und die App kurz von Hand ausprobieren.
- **GitHub Actions** werden monatlich aktualisiert.

Abhängigkeits-Updates allein brauchen kein eigenes Release. Sie gehen mit dem nächsten Release raus, außer bei Sicherheitsupdates: dann ein PATCH-Release.

### TypeScript 7 und die Linter-API

TypeScript 7.0.2 bietet noch keine JavaScript-Compiler-API. Deshalb verwendet `typescript-eslint` die API von TypeScript 6, während Typprüfung und Build bereits mit TypeScript 7 laufen. Das entspricht der [von Microsoft beschriebenen parallelen Installation](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60).

In `package.json` zeigt `@typescript/native` auf `npm:typescript@~7.0.2` und `typescript` auf `npm:@typescript/typescript6@6.0.2`. Das Kompatibilitätspaket bringt seinerseits TypeScript 6 mit. Da dabei mehrere Pakete einen `tsc`-Befehl bereitstellen können, wählt `npm run typecheck` den Compiler unter `node_modules/@typescript/native/bin/tsc` ausdrücklich aus. `npm run build` führt dieselbe Typprüfung vor dem Vite-Build aus.

Nach Abhängigkeitsänderungen regulär mit `npm ci` installieren und die tatsächlich verwendeten Versionen prüfen:

```bash
node node_modules/@typescript/native/bin/tsc --version  # Version 7.0.2
node -p "require('typescript').version"                # API-Version 6.x
npm run check
npm run test:e2e
```

Die Kompatibilitätsschicht kann entfallen, sobald die eingesetzten API-Werkzeuge TypeScript 7 unterstützen. Ein Update des nativen Compilers allein ändert die API-Version des Linters nicht.

## Wenn etwas schiefgeht

- **Pages-Workflow rot:** Ist unter Settings → Pages „GitHub Actions“ gewählt? Sonst das Log des Schritts lesen. Die zuletzt veröffentlichte Version bleibt so lange online.
- **Fehlerhafte Version veröffentlicht:** Den Fehler-Commit auf `main` per `git revert` zurücknehmen und pushen. Nach grüner CI ist die vorige Fassung wieder online. Danach ein PATCH-Release.
- **Release-Workflow rot wegen Versionsnummer:** Version in `package.json` bzw. den CHANGELOG-Abschnitt korrigieren und den Workflow erneut starten. Wurde ein falscher Tag gepusht, ihn vorher löschen (`git push --delete origin vX.Y.Z`).
