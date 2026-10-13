import type { Library, LibraryStatus, Project } from '@/core/blueprint'

/** Kurzinfo für die Projektliste, ohne den ganzen Blueprint. */
export interface ProjectSummary {
  id: string
  name: string
  updatedAt: string
  /** Vollständigkeit in Prozent, siehe `computeCompleteness`. */
  completeness: number
  /** Bibliothek oder Papierkorb, samt Zeitpunkt für die Restzeit. */
  library: Library
  /** Ob der Eintrag einen Steckbrief hat. */
  hasProfile: boolean
}

export interface ListFilter {
  /** Nur Einträge mit diesem Status; ohne Angabe alle. */
  status?: LibraryStatus
}

/**
 * Speicherschnittstelle für Projekte. Die App nutzt IndexedDB (`DexieProjectRepository`),
 * Tests können `MemoryProjectRepository` verwenden. Beide erfüllen dieselbe Vertrags-Testsuite.
 *
 * Alle Methoden, die eine ID erwarten, werfen `ProjectNotFoundError`, wenn es das Projekt nicht gibt
 * (außer `get`, das `undefined` liefert).
 */
export interface ProjectRepository {
  /** Alle Projekte (optional nach Status gefiltert), zuletzt geänderte zuerst. */
  list(filter?: ListFilter): Promise<ProjectSummary[]>
  get(id: string): Promise<Project | undefined>
  create(name: string): Promise<Project>
  /**
   * Speichert ein geändertes Projekt und setzt `updatedAt` neu. Der Bibliotheksstatus bleibt wie
   * gespeichert; ihn ändern nur `trash` und `restore`.
   */
  save(project: Project): Promise<Project>
  rename(id: string, name: string): Promise<Project>
  /** Legt ein Projekt in den Papierkorb (ADR 0012). `updatedAt` bleibt unverändert. */
  trash(id: string): Promise<Project>
  /** Holt ein Projekt aus dem Papierkorb in die Bibliothek („Speichern“, „Wiederherstellen“). */
  restore(id: string): Promise<Project>
  /** Löscht ein Projekt endgültig, egal wo es liegt. */
  deleteForever(id: string): Promise<void>
  /**
   * Löscht endgültig alle Einträge im Papierkorb, deren Frist zu `now` abgelaufen ist.
   * Gespeicherte Einträge bleiben immer erhalten. Liefert die IDs der gelöschten Einträge.
   */
  purgeExpired(now: Date, retentionDays: number): Promise<string[]>
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
