# Übergabe nach Phase 1 – Datenmodell & Speicherung

- **Datum:** 2026-10-11
- **Version:** v0.1.0

## Was gebaut wurde

- Datenmodell, Vollständigkeits-Score, Migrationen und Exportformat in `src/core/blueprint` (siehe ADR 0002).
- Speicherung in IndexedDB (`src/core/storage`), dazu eine Memory-Variante für Tests.
- Projektliste und Projektseite (`src/features/projects`), Repository-Injektion über `src/app/useProjectRepository.ts`.

## Teststand

- 168 Unit- und Komponententests, 8 E2E-Tests, alle grün.
- Abdeckung: über 99 % Zeilen gesamt, `src/core` und Speicherung nahe 100 %.

## Bekannte offene Punkte

- Beschädigte Projekte werden in der Liste ausgeblendet (nicht gelöscht). Es gibt noch keine Anzeige dafür.
- Ungültige Namen werfen im Repository einen rohen `ZodError`. Die UI prüft Namen vorher selbst, ein eigener Fehlertyp wäre sauberer.
- `get()` kann schreiben, wenn ein Datensatz beim Lesen migriert wird. Das ist so gewollt.
- Die CI ist eingerichtet, läuft aber erst, wenn das Repository auf GitHub liegt.

## Erster Schritt in Phase 2

Einstellungsseite mit Feld für den OpenRouter-API-Key, Link zu https://openrouter.ai/keys und Verbindungstest;
dazu die `AiProvider`-Schnittstelle mit OpenRouter- und Mock-Implementierung.
