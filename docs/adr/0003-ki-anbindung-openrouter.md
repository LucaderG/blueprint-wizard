# ADR 0003: KI-Anbindung über OpenRouter

- **Status:** Angenommen
- **Datum:** 2026-10-11
- **Phase:** Phase 2

## Kontext

Die App braucht ein Sprachmodell für Einordnung, Fragen und Vorschläge. Es gibt keinen eigenen Server
(ADR 0001): Der Nutzer bringt seinen eigenen OpenRouter-API-Key mit, und die App ruft OpenRouter direkt
aus dem Browser auf. Antworten der KI müssen später zuverlässig in das Blueprint-Datenmodell passen.

## Entscheidung

- **Schnittstelle `AiProvider`** (`src/core/ai/types.ts`) mit `complete()` und `stream()`. Die App nutzt
  `OpenRouterProvider`, Tests und Demos `MockAiProvider`. Kein Feature spricht OpenRouter direkt an.
- **Einheitliche Fehler:** Jeder Fehler wird zu `AiError` mit einem festen `code` (z. B. `invalidKey`,
  `insufficientCredits`, `rateLimited`, `timeout`). Auch Fehler in einer 200-Antwort und mitten im Stream
  werden erkannt. Die UI übersetzt nur den Code.
- **Strukturierte Antworten:** `generateStructured()` wandelt ein Zod-Schema in JSON-Schema um, fordert es
  per `response_format` (Strict-Modus) an, verlangt mit `require_parameters` ein Modell, das das kann,
  validiert die Antwort mit Zod und bittet bei Fehlern genau einmal um Korrektur.
- **Schemas für KI-Antworten** verwenden `.nullable()` statt `.optional()`, weil der Strict-Modus alle
  Felder als Pflicht verlangt.
- **Einstellungen in `localStorage`** (`src/core/settings`), nicht in IndexedDB: wenige kleine Werte,
  synchron lesbar beim Start. Ungültige Felder fallen einzeln auf Standardwerte zurück.
- **Standardmodell `anthropic/claude-haiku-5.5`:** schnell, günstig (etwa 0,10 $ / 0,50 $ pro Million
  Tokens) und mit strukturierten Antworten laut OpenRouter-Modellliste. Ursprünglich war
  `anthropic/claude-sonnet-5.5` gewählt; nach dem ersten echten Test hat Luca am 2026-10-11 Haiku 5.5 als
  Standard festgelegt. Sonnet 5.5 bleibt die Empfehlung für tiefere Analysen und ist in den Einstellungen
  frei wählbar.
- **Timeout 90 Sekunden** pro Anfrage, Abbruch über `AbortSignal` möglich.

## Konsequenzen

- Der API-Key liegt im Klartext im `localStorage` dieses Browsers. Das ist für eine persönliche, lokale App
  vertretbar; die Einstellungsseite weist darauf hin und bietet „Key löschen“.
- Tests sind deterministisch: MSW (Unit) und `page.route` (E2E) ersetzen OpenRouter vollständig.
- Ein Wechsel des Anbieters bedeutet eine neue `AiProvider`-Implementierung, Features bleiben unverändert.

## Erwogene Alternativen

- **Offizielles OpenAI-SDK mit OpenRouter-Basis-URL:** zusätzliche Abhängigkeit, kein Vorteil für die
  wenigen Endpunkte, schlechter testbar. Verworfen.
- **Key verschlüsselt speichern:** ohne Server gäbe es keinen sicheren Ort für den Schlüssel. Verworfen.
- **Eigener Proxy-Server:** nur nötig, wenn die App öffentlich mit einem fremden Key laufen soll. Vertagt.
