import type { Blueprint, Maturity } from './schema'
import { SECTION_IDS, SECTION_WEIGHTS, type SectionId } from './sections'

const MATURITY_SCORE: Record<Maturity, number> = { empty: 0, vague: 0.5, decided: 1 }

export interface Completeness {
  /** Gewichteter Gesamtwert in Prozent (0–100, ganzzahlig). */
  total: number
  /** Wert pro Abschnitt in Prozent (0, 50 oder 100). */
  sections: Record<SectionId, number>
}

/**
 * Berechnet, wie weit ein Blueprint ausgearbeitet ist.
 * Leer zählt 0, vage 0,5, entschieden 1; der Gesamtwert ist das nach `SECTION_WEIGHTS` gewichtete Mittel.
 */
export function computeCompleteness(blueprint: Blueprint): Completeness {
  let weighted = 0
  let totalWeight = 0
  const sections = {} as Record<SectionId, number>

  for (const id of SECTION_IDS) {
    const score = MATURITY_SCORE[blueprint.sections[id].maturity]
    const weight = SECTION_WEIGHTS[id]
    sections[id] = Math.round(score * 100)
    weighted += score * weight
    totalWeight += weight
  }

  return { total: Math.round((weighted / totalWeight) * 100), sections }
}
