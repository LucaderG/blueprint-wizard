import { SECTION_IDS, type Blueprint, type Maturity } from '@/core/blueprint'

/** Reifegrade in aufsteigender Reihenfolge: leer → vage → entschieden. */
export const MATURITY_OPTIONS: readonly Maturity[] = ['empty', 'vague', 'decided']

/** Farbpunkt der Reifegrad-Ampel; die Farben stehen als Tokens in `src/index.css`. */
export const MATURITY_DOT_CLASS: Record<Maturity, string> = {
  empty: 'bg-maturity-empty',
  vague: 'bg-maturity-vague',
  decided: 'bg-maturity-decided',
}

/** Zählt, wie viele Abschnitte je Reifegrad gesetzt sind. */
export function countByMaturity(blueprint: Blueprint): Record<Maturity, number> {
  const counts: Record<Maturity, number> = { empty: 0, vague: 0, decided: 0 }
  for (const id of SECTION_IDS) counts[blueprint.sections[id].maturity] += 1
  return counts
}
