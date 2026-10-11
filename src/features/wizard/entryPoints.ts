import type { EntryPoint } from '@/core/blueprint'

/** URL-Slugs der Einstiegspunkte (`/neu/:entryPoint`). */
export const ENTRY_POINT_SLUGS: Record<EntryPoint, string> = {
  noIdea: 'keine-idee',
  partialIdea: 'teil-idee',
  almostDone: 'fast-fertig',
}

export function entryPointPath(entryPoint: EntryPoint): string {
  return `/neu/${ENTRY_POINT_SLUGS[entryPoint]}`
}

/** Ordnet einen URL-Slug seinem Einstiegspunkt zu. Unbekannte Slugs ergeben `null`. */
export function entryPointFromSlug(slug: string): EntryPoint | null {
  const entries = Object.entries(ENTRY_POINT_SLUGS) as [EntryPoint, string][]
  return entries.find(([, value]) => value === slug)?.[0] ?? null
}
