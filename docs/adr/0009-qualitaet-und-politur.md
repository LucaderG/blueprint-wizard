# ADR 0009: Darstellung, Kostenanzeige, PWA und Qualitätsprüfungen

- **Status:** Angenommen
- **Datum:** 2026-10-11
- **Phase:** Phase 8

## Kontext

Phase 8 verlangt leere und Fehlerzustände, Barrierefreiheit, Dunkelmodus, responsive Layouts, eine Kostenanzeige pro Runde, eine englische Übersetzung, eine installierbare PWA und einen Performance-Check. Abnahme: keine kritischen a11y-Befunde, Lighthouse ≥ 90. Alles muss weiter ohne Server laufen.

## Entscheidung

- **Sprache und Farbschema** sind Einstellungen (`uiLanguage`, `theme`) im bestehenden `localStorage`-Schema mit Standardwerten, damit alte Einstellungen weiter laden. Der Dunkelmodus hängt an der Klasse `dark` auf `<html>` (Tailwind `@custom-variant`), nicht mehr an der Media-Query. So kann der Nutzer ihn erzwingen. Ein kleines Inline-Skript in `index.html` setzt Klasse und `lang` vor dem ersten Rendern, um Aufflackern zu vermeiden.
- **Englisch** liegt als `en.json` neben `de.json`. Deutsch bleibt die Quelle der typisierten Keys. Ein Test erzwingt gleiche Keys und Platzhalter. Formatierung von Zahlen, Daten und Beträgen läuft zentral über `src/shared/lib/format.ts` nach UI-Sprache. Die Sprache der KI-Antworten bleibt eine eigene Einstellung.
- **Kosten:** OpenRouter liefert mit `usage: { include: true }` Tokens und Kosten in jeder Antwort. `UsageTrackingProvider` im Kern umschließt den Anbieter und meldet jeden erfolgreichen Aufruf; der Verbrauch lebt im `sessionStorage` (max. 200 Einträge), nicht im Projekt. Fehlt eine Kostenangabe, zeigt die Summe „≥“. Keine eigene Preistabelle: sie würde veralten.
- **PWA** über `vite-plugin-pwa` (Workbox, `autoUpdate`, Navigations-Fallback auf `index.html`). In E2E-Tests blockiert Playwright Service Worker, weil sie Anfragen an `page.route` vorbei abwickeln würden; `e2e/pwa.spec.ts` erlaubt ihn gezielt und prüft Manifest und Offline-Start.
- **Performance:** Seiten außer Start und 404 werden per Route-`lazy` geladen; der pauschale Vendor-Chunk entfällt, damit Bibliotheken wie `fflate` mit ihrer Seite geladen werden. Ladeanzeige und Fehlerseite (`RouteStates.tsx`) decken fehlgeschlagene Chunks ab.
- **Prüfungen:** axe (`@axe-core/playwright`) prüft alle Seiten in hell und dunkel auf ernste und kritische Befunde. Lighthouse CI läuft als eigener CI-Job gegen den Build (Startseite und Einstellungen, Mindestwert 0,9 je Kategorie).

## Konsequenzen

- Jeder neue UI-Text braucht beide Sprachen, sonst schlägt der Paritätstest fehl.
- Tests rendern Seiten über `renderRoute`, das die Lazy-Routen vorab auflöst; Komponenten-Tests bleiben synchron abfragbar.
- Kostenangaben sind die von OpenRouter gemeldeten Werte und gelten nur für den aktuellen Tab.
- Export-Dokumente folgen der UI-Sprache (Beschriftungen kommen aus i18n).

## Erwogene Alternativen

- **Dunkelmodus nur per System-Media-Query:** einfacher, aber nicht vom Nutzer wählbar.
- **Kosten aus einer eigenen Preistabelle:** veraltet schnell und ist bei vielen Modellen fehleranfällig.
- **Verbrauch im Projekt speichern:** hätte eine Schemaänderung samt Migration gebraucht und vermischt Abrechnung mit Inhalt.
- **Service Worker auch in allen E2E-Tests:** macht Netzwerk-Mocks unzuverlässig.
