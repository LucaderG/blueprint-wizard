# Übergabe nach Phase 7 – Blueprint-Generierung & Export

Stand: 2026-10-11, v0.7.0. Ausgangspunkt: `90eb832` (v0.6.0).

## Gebaut

- Projektaktion „Blueprint fertigstellen“, Exportseite `/projekte/:projectId/export`.
- Informierender Reife-Check, Export auch mit offenen Punkten und ohne API-Key.
- Reine Generatoren mit übergebenen Übersetzungen in `src/core/export`: vollständiger Blueprint, beide identischen Kontextdateien, Aufgaben samt Phasenvorlage/Abnahme und Start-Prompt.
- Vorschau aller fünf Dateien, Markdown-Einzeldownload, ZIP-Download, Start-Prompt kopieren mit manueller Rückfallmöglichkeit.
- Vorhandene Roadmap hat Vorrang vor der Vorlage. Eigener Inhalt bleibt erhalten. Entscheidungen, Folgen, Antworten, offene Empfehlungen und frühere Analysen bleiben sichtbar.
- `fflate` als ZIP-Bibliothek (ADR 0008). Projektschema weiterhin v3, keine Migration erforderlich.
- README, Arbeitsregeln, Changelog und Version aktualisiert.

## Prüfungen

- `npm run check`: Lint, Formatprüfung, Typcheck und vollständige Tests mit Abdeckungsprüfung.
- `npm run test:e2e`: komplette Browser-Testsuite einschließlich neuer Export-Abnahme.
- Neue E2E-Abnahme prüft einen sofortigen Wechsel nach Abschnittsbearbeitung, alle fünf Vorschauen, den tatsächlichen ZIP-Inhalt, Einzeldownload, Zwischenablage, Neuladen und den unveränderten Projektinhalt.
- Ein importiertes v2-Altprojekt wird migriert und mit Entscheidungen und Antworten korrekt exportiert; bestehende Migrationstests bleiben unverändert.
- Browser-Demo mit dem unvollständigen Phase-6-Beispiel „Koch-Leihbörse“, vollständigem Beispiel sowie schmalem Bildschirm. Screenshots unter `docs/screenshots/`.

Ergebnisse: `npm run check` grün (1.274 Tests in 66 Dateien), alle 22 E2E-Tests grün; Gesamt-Zeilenabdeckung 98,52 %, neue Export-Kernlogik 98,24 % Zeilen und 86,66 % Zweige. Die Browser-Demo zeigt keinen horizontalen Überlauf bei 390 px und keine JavaScript-Fehler. Das erzeugte ZIP wurde in einen leeren Ordner entpackt und enthält alle fünf Dateien.

- [Export mit offenen Punkten](../screenshots/phase-7-export-offen.png)
- [Ausgearbeiteter Blueprint und TASKS-Vorschau](../screenshots/phase-7-export-fertig.png)
- [Mobile Ansicht](../screenshots/phase-7-export-mobil.png)

Review gegen die Arbeitsregeln: keine Verstöße. Die gemeinsame Übersetzung für Abschnitte und Reifegrade wird wiederverwendet. Review gegen Phase 7: keine bestätigten Anforderungslücken; die Kennzeichnung einer nicht übernommenen Roadmap wurde zusätzlich in TASKS.md vereinheitlicht.

Ein bestehender Fragenmotor-E2E-Test erkannte beim Seitenwechsel noch den gleich benannten Vorher/Nachher-Artikel als Projektseite und lud zu früh neu. Er wartet jetzt auf die echte Projektseite und den Abschnitt in ihrer Übersicht; drei gezielte Wiederholungen bestanden. Kein Produktcode musste dafür geändert werden.

## Offen für Luca

- Paket in einem leeren Projektordner mit seinem bevorzugten KI-Coding-Tool ausprobieren. Die Dateien sind als Einstieg gedacht; fehlende Anforderungen müssen dabei weiterhin geklärt werden.
- Der in der Phase-6-Übergabe genannte echte Key-Test der Ideenfindung ist weiterhin Lucas eigener Test. Phase 7 benötigt keinen KI-Aufruf.
- Review der Demo und Freigabe für Phase 8. Phase 8 startet erst danach.
- GitHub-Release/Tag nach gewünschtem Veröffentlichungsablauf; kein automatischer Tag-Push aus dieser Phase.

## Nächster Schritt: Phase 8 – Qualität & Politur

Zuerst leere Zustände, Fehlerfälle und Tastaturbedienung über alle Seiten prüfen. Danach axe, Dark Mode, responsive Layouts, englische Übersetzung, Kostenanzeige, PWA und Performance laut Plan. Dabei besonders die synchron erzeugten ZIPs und die Lesbarkeit längerer Export-Hinweise prüfen.
