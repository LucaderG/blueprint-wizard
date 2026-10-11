import { ProjectFormatError, type ProjectFormatErrorCode } from '@/core/blueprint'
import { ProjectNotFoundError } from '@/core/storage'

export type ProjectErrorKey =
  | `projects.errors.import.${ProjectFormatErrorCode}`
  | 'projects.errors.notFound'
  | 'projects.errors.generic'

/** Ordnet Fehler aus Repository und Import einer verständlichen Meldung (i18n-Key) zu. */
export function projectErrorKey(error: unknown): ProjectErrorKey {
  if (error instanceof ProjectFormatError) return `projects.errors.import.${error.code}`
  if (error instanceof ProjectNotFoundError) return 'projects.errors.notFound'
  return 'projects.errors.generic'
}
