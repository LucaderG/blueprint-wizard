import type { Project } from '@/core/blueprint'

/** Kurzinfo für die Projektliste, ohne den ganzen Blueprint. */
export interface ProjectSummary {
  id: string
  name: string
  updatedAt: string
  /** Vollständigkeit in Prozent, siehe `computeCompleteness`. */
  completeness: number
}

/**
 * Speicherschnittstelle für Projekte. Die App nutzt IndexedDB (`DexieProjectRepository`),
 * Tests können `MemoryProjectRepository` verwenden. Beide erfüllen dieselbe Vertrags-Testsuite.
 *
 * Alle Methoden, die eine ID erwarten, werfen `ProjectNotFoundError`, wenn es das Projekt nicht gibt
 * (außer `get`, das `undefined` liefert).
 */
export interface ProjectRepository {
  /** Alle Projekte, zuletzt geänderte zuerst. */
  list(): Promise<ProjectSummary[]>
  get(id: string): Promise<Project | undefined>
  create(name: string): Promise<Project>
  /** Speichert ein geändertes Projekt und setzt `updatedAt` neu. */
  save(project: Project): Promise<Project>
  rename(id: string, name: string): Promise<Project>
  delete(id: string): Promise<void>
  /** Legt eine Kopie mit neuer ID und dem Namenszusatz „(Kopie)“ an. */
  duplicate(id: string): Promise<Project>
  /** Liefert die Exportdatei als JSON-Text. */
  exportProject(id: string): Promise<string>
  /** Importiert eine Exportdatei. Das Projekt bekommt immer eine neue ID, damit nichts überschrieben wird. */
  importProject(json: string): Promise<Project>
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Projekt ${id} nicht gefunden`)
    this.name = 'ProjectNotFoundError'
  }
}

export interface RepositoryDeps {
  now?: () => Date
  newId?: () => string
}
