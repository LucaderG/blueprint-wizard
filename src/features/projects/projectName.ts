import { PROJECT_NAME_MAX_LENGTH } from '@/core/blueprint'
import { slugify } from '@/shared/lib/slugify'

export type ProjectNameError = 'required' | 'tooLong'

/** Prüft einen Projektnamen wie das Schema (getrimmt, 1 bis `PROJECT_NAME_MAX_LENGTH` Zeichen). */
export function validateProjectName(name: string): ProjectNameError | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'required'
  if (trimmed.length > PROJECT_NAME_MAX_LENGTH) return 'tooLong'
  return null
}

/** Dateiname für den Export, z. B. „Mein Projekt“ → `mein-projekt.blueprint.json`. */
export function exportFileName(name: string): string {
  return `${slugify(name) || 'projekt'}.blueprint.json`
}
