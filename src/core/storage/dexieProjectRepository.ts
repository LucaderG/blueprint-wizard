import { isTrashExpired, migrateProject, type Project } from '@/core/blueprint'
import { BlueprintDb, type StoredProject } from './db'
import {
  buildDuplicate,
  buildImported,
  buildNewProject,
  buildRestored,
  buildSaved,
  buildTrashed,
  exportJson,
  matchesFilter,
  sortByUpdatedDesc,
  toSummary,
  withName,
} from './projectOperations'
import {
  ProjectNotFoundError,
  type ListFilter,
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

  /** Alle lesbaren Projekte. Beschädigte Datensätze bleiben erhalten (Nutzerdaten!), nur außen vor. */
  private async readable(): Promise<Project[]> {
    const records = await this.db.projects.toArray()
    const projects: Project[] = []
    for (const raw of records) {
      try {
        projects.push(await this.upgrade(raw))
      } catch (error) {
        console.warn(`Projekt ${String(raw.id)} ist unlesbar und wird übersprungen`, error)
      }
    }
    return projects
  }

  list(filter: ListFilter = {}): Promise<ProjectSummary[]> {
    return this.rw(async () => {
      const projects = (await this.readable()).filter((p) => matchesFilter(p, filter))
      return sortByUpdatedDesc(projects.map(toSummary))
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
      const saved = buildSaved(project, await this.require(project.id), this.now())
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

  trash(id: string): Promise<Project> {
    return this.rw(async () => {
      const trashed = buildTrashed(await this.require(id), this.now())
      await this.db.projects.put(trashed)
      return trashed
    })
  }

  restore(id: string): Promise<Project> {
    return this.rw(async () => {
      const restored = buildRestored(await this.require(id))
      await this.db.projects.put(restored)
      return restored
    })
  }

  purgeExpired(now: Date, retentionDays: number): Promise<string[]> {
    return this.rw(async () => {
      const expired = (await this.readable())
        .filter((p) => isTrashExpired(p.library, now, retentionDays))
        .map((p) => p.id)
      await this.db.projects.bulkDelete(expired)
      return expired
    })
  }

  deleteForever(id: string): Promise<void> {
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
