import { migrateProject, type Project } from '@/core/blueprint'
import { BlueprintDb, type StoredProject } from './db'
import {
  buildDuplicate,
  buildImported,
  buildNewProject,
  exportJson,
  sortByUpdatedDesc,
  toSummary,
  touch,
  withName,
} from './projectOperations'
import {
  ProjectNotFoundError,
  type ProjectRepository,
  type ProjectSummary,
  type RepositoryDeps,
} from './projectRepository'

export interface DexieProjectRepositoryOptions extends RepositoryDeps {
  db?: BlueprintDb
}

/**
 * Dauerhafte Speicherung in IndexedDB. Jeder gelesene Datensatz läuft durch `migrateProject`;
 * wurde er dabei auf eine neuere Schemaversion gehoben, wird die neue Fassung zurückgeschrieben.
 */
export class DexieProjectRepository implements ProjectRepository {
  private readonly db: BlueprintDb
  private readonly now: () => Date
  private readonly newId: () => string

  constructor({
    db = new BlueprintDb(),
    now = () => new Date(),
    newId = () => crypto.randomUUID(),
  }: DexieProjectRepositoryOptions = {}) {
    this.db = db
    this.now = now
    this.newId = newId
  }

  /** Migriert einen Rohdatensatz und schreibt ihn bei einer Versionsänderung zurück. Nur in rw-Transaktionen aufrufen. */
  private async upgrade(raw: StoredProject): Promise<Project> {
    const project = migrateProject(raw)
    if (raw.schemaVersion !== project.schemaVersion) {
      await this.db.projects.put(project)
    }
    return project
  }

  private async require(id: string): Promise<Project> {
    const raw = await this.db.projects.get(id)
    if (!raw) throw new ProjectNotFoundError(id)
    return this.upgrade(raw)
  }

  private async insert(project: Project): Promise<Project> {
    // `add` statt `put`: Eine (unwahrscheinliche) ID-Kollision darf nie ein Projekt überschreiben.
    await this.db.projects.add(project)
    return project
  }

  private rw<T>(work: () => Promise<T>): Promise<T> {
    return this.db.transaction('rw', this.db.projects, work)
  }

  list(): Promise<ProjectSummary[]> {
    return this.rw(async () => {
      const records = await this.db.projects.toArray()
      const summaries: ProjectSummary[] = []
      for (const raw of records) {
        try {
          summaries.push(toSummary(await this.upgrade(raw)))
        } catch (error) {
          // Beschädigte Datensätze nicht löschen (Nutzerdaten!), nur aus der Liste heraushalten.
          console.warn(`Projekt ${String(raw.id)} ist unlesbar und wird übersprungen`, error)
        }
      }
      return sortByUpdatedDesc(summaries)
    })
  }

  get(id: string): Promise<Project | undefined> {
    return this.rw(async () => {
      const raw = await this.db.projects.get(id)
      return raw && this.upgrade(raw)
    })
  }

  create(name: string): Promise<Project> {
    return this.rw(() => this.insert(buildNewProject(name, this.newId(), this.now())))
  }

  save(project: Project): Promise<Project> {
    return this.rw(async () => {
      const exists = (await this.db.projects.where('id').equals(project.id).count()) > 0
      if (!exists) throw new ProjectNotFoundError(project.id)
      const saved = touch(project, this.now())
      await this.db.projects.put(saved)
      return saved
    })
  }

  rename(id: string, name: string): Promise<Project> {
    return this.rw(async () => {
      const renamed = withName(await this.require(id), name, this.now())
      await this.db.projects.put(renamed)
      return renamed
    })
  }

  delete(id: string): Promise<void> {
    // Absichtlich ohne Migration: Auch unlesbare Datensätze sollen sich löschen lassen.
    return this.rw(async () => {
      const exists = (await this.db.projects.where('id').equals(id).count()) > 0
      if (!exists) throw new ProjectNotFoundError(id)
      await this.db.projects.delete(id)
    })
  }

  duplicate(id: string): Promise<Project> {
    return this.rw(async () => {
      const original = await this.require(id)
      return this.insert(buildDuplicate(original, this.newId(), this.now()))
    })
  }

  exportProject(id: string): Promise<string> {
    return this.rw(async () => exportJson(await this.require(id), this.now()))
  }

  importProject(json: string): Promise<Project> {
    return this.rw(async () => this.insert(buildImported(json, this.newId(), this.now())))
  }
}
