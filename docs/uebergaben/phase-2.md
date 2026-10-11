# Übergabe nach Phase 2 – Einstellungen & OpenRouter-Anbindung

- **Datum:** 2026-10-11
- **Version:** v0.2.0

## Was gebaut wurde

- `src/core/ai`: `AiProvider`, `OpenRouterProvider` (Antworten, Streaming, Fehlerbehandlung), `MockAiProvider`,
  `generateStructured` mit Reparaturversuch, Key-Prüfung und Modellliste (ADR 0003).
- `src/core/settings`: Einstellungen (Key, Modell, Temperatur, Antwortsprache) in `localStorage`.
- `src/app`: `SettingsProvider`, `useSettings()`, `useAiProvider()`.
- `src/features/settings`: Einstellungsseite mit Link zu OpenRouter, Verbindungstest, Modellwahl,
  Antwort-Einstellungen; Hinweis auf der Startseite ohne Key; deutsche Meldungen für alle KI-Fehler.

## Arbeitsweise

Die Tests für den KI-Kern und die Einstellungsseite wurden von Haiku-Helfern parallel gebaut und danach
geprüft. Die Kern-Tests fanden zwei echte Fehler (Nicht-JSON-Antwort mit Status 200, Key nur aus
Leerzeichen), beide sind behoben.

## Teststand

- 389 Unit- und Komponententests, 12 E2E-Tests, alle grün; `src/core` bei 100 % Abdeckung.

## Bekannte offene Punkte

- **Manueller Test mit echtem Key steht aus:** OpenRouter ist aus der Entwicklungsumgebung nicht erreichbar.
  Bitte einmal Key eintragen und „Verbindung testen“ klicken.
- Der Hinweis „Gespeichert“ bleibt sichtbar, bis die Seite neu geladen wird.
- Der API-Key liegt unverschlüsselt im `localStorage` (siehe ADR 0003).

## Erster Schritt in Phase 3

Einstiegsauswahl auf der Startseite aktivieren und die Einordnung eines Freitexts in die zehn Abschnitte
per `generateStructured` bauen (erster versionierter Prompt in `src/core/ai/prompts/`).
