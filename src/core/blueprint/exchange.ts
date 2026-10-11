import { ProjectFormatError } from './errors'
import { migrateProject } from './migrations'
import type { Project } from './schema'

/** Kennung der Exportdatei, damit fremde JSON-Dateien sauber abgelehnt werden. */
export const EXPORT_FORMAT = 'blueprint-wizard/project'

export interface ProjectExport {
  format: typeof EXPORT_FORMAT
  exportedAt: string
  project: Project
}

export function serializeProject(project: Project, now: Date): string {
  const payload: ProjectExport = { format: EXPORT_FORMAT, exportedAt: now.toISOString(), project }
  return JSON.stringify(payload, null, 2)
}

/** Liest eine Exportdatei (auch aus älteren App-Versionen) und liefert ein gültiges, aktuelles Projekt. */
export function parseProjectExport(json: string): Project {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (cause) {
    throw new ProjectFormatError('invalidJson', 'Die Datei enthält kein gültiges JSON', { cause })
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { format?: unknown }).format !== EXPORT_FORMAT
  ) {
    throw new ProjectFormatError('invalidFormat', 'Die Datei ist kein Blueprint-Wizard-Projekt')
  }

  return migrateProject((parsed as { project?: unknown }).project)
}
