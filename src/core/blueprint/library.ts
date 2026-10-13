import type { Library, Project } from './schema'

/** Wählbare Aufbewahrungsfristen des Papierkorbs in Tagen (ADR 0012). */
export const TRASH_RETENTION_DAYS = [1, 7, 30] as const
export type TrashRetentionDays = (typeof TRASH_RETENTION_DAYS)[number]

const DAY_MS = 24 * 60 * 60 * 1000

/** Legt ein Projekt in den Papierkorb. Liegt es schon dort, bleibt der erste Zeitpunkt. */
export function moveToTrash(project: Project, now: Date): Project {
  if (project.library.status === 'trashed') return project
  return { ...project, library: { status: 'trashed', trashedAt: now.toISOString() } }
}

/** Holt ein Projekt aus dem Papierkorb in die Bibliothek („Speichern“, „Wiederherstellen“). */
export function restoreFromTrash(project: Project): Project {
  if (project.library.status === 'saved') return project
  return { ...project, library: { status: 'saved', trashedAt: null } }
}

/** Zeitpunkt der Endlöschung; `null` für gespeicherte Einträge. */
export function trashExpiresAt(library: Library, retentionDays: number): Date | null {
  if (library.trashedAt === null) return null
  return new Date(Date.parse(library.trashedAt) + retentionDays * DAY_MS)
}

/** Ob ein Eintrag im Papierkorb seine Frist erreicht hat. Gespeicherte Einträge laufen nie ab. */
export function isTrashExpired(library: Library, now: Date, retentionDays: number): boolean {
  const expiresAt = trashExpiresAt(library, retentionDays)
  return expiresAt !== null && expiresAt.getTime() <= now.getTime()
}
