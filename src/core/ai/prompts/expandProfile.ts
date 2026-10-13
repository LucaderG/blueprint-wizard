import type { ProjectProfile } from '@/core/blueprint/schema'
import type { ChatMessage } from '../types'
import { LANGUAGE_NAME } from './analyzeBlueprint'
import { SECTION_GUIDE } from './classifyIdea'

/**
 * Prompt „Voll ausarbeiten“: schreibt aus einem Steckbrief alle zehn Blueprint-Abschnitte aus.
 * Die Antwort nutzt das Schema der Einordnung (`classificationSchema`), damit `applyClassification`
 * sie übernimmt und eigenen Inhalt nie überschreibt.
 * Bei inhaltlichen Änderungen am Prompt `version` erhöhen und die Golden Files neu erzeugen.
 */
export const EXPAND_PROFILE_PROMPT_ID = 'expand-profile'
export const EXPAND_PROFILE_PROMPT_VERSION = 1

export interface ExpandProfileInput {
  name: string
  profile: ProjectProfile
  language: 'de' | 'en'
}

const EFFORT_TEXT: Record<ProjectProfile['effort'], string> = {
  small: 'klein (ein paar Abende)',
  medium: 'mittel (einige Wochenenden)',
  large: 'groß (mehrere Wochen und mehr)',
}

const orNone = (text: string) => (text.trim() ? text.trim() : '(keine Angabe)')
const listOrNone = (items: readonly string[]) =>
  items.length > 0 ? items.map((item) => `  - ${item}`).join('\n') : '  (keine)'

/** Ein Steckbrief als lesbarer Text für die KI. */
export function describeProjectProfile(name: string, profile: ProjectProfile): string {
  const { model, priceRange, reason } = profile.monetization
  return `Titel: ${name}
Kurzbeschreibung: ${profile.pitch}
Problem: ${orNone(profile.problem)}
Zielgruppe: ${orNone(profile.audience)}
Kernfunktionen:
${listOrNone(profile.features)}
Plattform: ${orNone(profile.platform)}
Monetarisierung: ${orNone(model)}; Preisrahmen (Annahme): ${orNone(priceRange)}; Begründung: ${orNone(reason)}
Aufwand: ${EFFORT_TEXT[profile.effort]}
Risiken:
${listOrNone(profile.risks)}`
}

export function buildExpandProfileMessages({
  name,
  profile,
  language,
}: ExpandProfileInput): ChatMessage[] {
  const guide = Object.entries(SECTION_GUIDE)
    .map(([id, description]) => `- ${id}: ${description}`)
    .join('\n')

  const system = `Du hilfst Menschen, aus einer Projektidee einen klaren Blueprint für die Softwareentwicklung zu machen.

Aufgabe: Arbeite den Steckbrief zu einem vollständigen Blueprint aus. Schreibe jeden der zehn Abschnitte aus.

Abschnitte:
${guide}

Regeln:
- Baue auf dem Steckbrief auf und widersprich ihm nicht. Was er offen lässt, ergänzt du mit naheliegenden, bescheidenen Annahmen für eine erste Version.
- Schreibe pro Abschnitt konkret als Markdown (Stichpunkte erlaubt), knapp genug für einen schnellen Überblick.
- Reifegrad pro Abschnitt: "decided", wenn der Steckbrief es klar festlegt; sonst "vague", weil es deine Annahme ist.
- Gib alle zehn Abschnitte zurück, keinen leer.
- projectName: null (der Titel steht schon fest).
- summary: ein Satz, worum es im Projekt geht.
- Schreibe alle Inhalte auf ${LANGUAGE_NAME[language]}.
- Antworte ausschließlich mit JSON nach dem vorgegebenen Schema.`

  return [
    { role: 'system', content: system },
    { role: 'user', content: `# Steckbrief\n${describeProjectProfile(name, profile)}` },
  ]
}
