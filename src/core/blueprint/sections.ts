/**
 * Katalog der Blueprint-Abschnitte (Version 1).
 *
 * Die Reihenfolge hier ist die Anzeigereihenfolge. Das Gewicht bestimmt, wie stark ein Abschnitt
 * in den Vollständigkeits-Score eingeht: Grundsatzthemen zählen mehr als Details.
 * Anzeigenamen liegen nicht hier, sondern in den i18n-Dateien unter `sections.<id>`.
 */
export const SECTION_IDS = [
  'problem',
  'audience',
  'features',
  'nonGoals',
  'flows',
  'dataModel',
  'techStack',
  'integrations',
  'risks',
  'roadmap',
] as const

export type SectionId = (typeof SECTION_IDS)[number]

export const SECTION_WEIGHTS: Record<SectionId, number> = {
  problem: 3,
  audience: 2,
  features: 3,
  nonGoals: 1,
  flows: 2,
  dataModel: 1,
  techStack: 2,
  integrations: 1,
  risks: 1,
  roadmap: 1,
}
