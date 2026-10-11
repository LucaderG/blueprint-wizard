# `src/core`

Reine TypeScript-Logik ohne React: Blueprint-Datenmodell, Fragenmotor, KI-Client, Speicherung.

Regel: Nichts in `core/` importiert aus `react`, `features/` oder `app/`. So bleibt die Logik
einfach testbar und austauschbar. Die Unterordner entstehen ab Phase 1.
