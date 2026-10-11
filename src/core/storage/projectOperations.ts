import {
  computeCompleteness,
  createEmptyProject,
  parseProjectExport,
  projectNameSchema,
  projectSchema,
  serializeProject,
  type Project,
} from '@/core/blueprint'
import type { ProjectSummary } from './projectRepository'

/**
 * Gemeinsame, speicherunabhängige Logik aller Repository-Implementierungen.
 * So verhalten sich IndexedDB- und Memory-Variante garantiert gleich.
 */
export const DUPLICATE_SUFFIX = ' (Kopie)'

export function toSummary(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    completeness: computeCompleteness(project.blueprint).total,
  }
}

export function sortByUpdatedDesc(summaries: ProjectSummary[]): ProjectSummary[] {
  return [...summaries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function buildNewProject(name: string, id: string, now: Date): Project {
  return createEmptyProject({ id, name: projectNameSchema.parse(name), now })
}

export function touch(project: Project, now: Date): Project {
  return projectSchema.parse({ ...project, updatedAt: now.toISOString() })
}

export function withName(project: Project, name: string, now: Date): Project {
  return touch({ ...project, name: projectNameSchema.parse(name) }, now)
}

export function buildDuplicate(project: Project, id: string, now: Date): Project {
  const timestamp = now.toISOString()
  const name = (project.name + DUPLICATE_SUFFIX).slice(0, 120)
  return { ...structuredClone(project), id, name, createdAt: timestamp, updatedAt: timestamp }
}

export function exportJson(project: Project, now: Date): string {
  return serializeProject(project, now)
}

export function buildImported(json: string, id: string, now: Date): Project {
  const imported = parseProjectExport(json)
  return { ...imported, id, updatedAt: now.toISOString() }
}
