import { isTrashExpired, type Project } from '@/core/blueprint'
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

/** Flüchtige Implementierung für Tests und Vorschauen. */
export class MemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, Project>()
  private readonly now: () => Date
  private readonly newId: () => string

  constructor({ now = () => new Date(), newId = () => crypto.randomUUID() }: RepositoryDeps = {}) {
    this.now = now
    this.newId = newId
  }

  private require(id: string): Project {
    const project = this.projects.get(id)
    if (!project) throw new ProjectNotFoundError(id)
    return project
  }

  private put(project: Project): Project {
    this.projects.set(project.id, structuredClone(project))
    return structuredClone(project)
  }

  async list(filter: ListFilter = {}): Promise<ProjectSummary[]> {
    const projects = [...this.projects.values()].filter((p) => matchesFilter(p, filter))
    return sortByUpdatedDesc(projects.map(toSummary))
  }

  async get(id: string): Promise<Project | undefined> {
    const project = this.projects.get(id)
    return project && structuredClone(project)
  }

  async create(name: string): Promise<Project> {
    return this.put(buildNewProject(name, this.newId(), this.now()))
  }

  async save(project: Project): Promise<Project> {
    return this.put(buildSaved(project, this.require(project.id), this.now()))
  }

  async rename(id: string, name: string): Promise<Project> {
    return this.put(withName(this.require(id), name, this.now()))
  }

  async trash(id: string): Promise<Project> {
    return this.put(buildTrashed(this.require(id), this.now()))
  }

  async restore(id: string): Promise<Project> {
    return this.put(buildRestored(this.require(id)))
  }

  async deleteForever(id: string): Promise<void> {
    this.require(id)
    this.projects.delete(id)
  }

  async purgeExpired(now: Date, retentionDays: number): Promise<string[]> {
    const expired = [...this.projects.values()]
      .filter((p) => isTrashExpired(p.library, now, retentionDays))
      .map((p) => p.id)
    for (const id of expired) this.projects.delete(id)
    return expired
  }

  async duplicate(id: string): Promise<Project> {
    return this.put(buildDuplicate(this.require(id), this.newId(), this.now()))
  }

  async exportProject(id: string): Promise<string> {
    return exportJson(this.require(id), this.now())
  }

  async importProject(json: string): Promise<Project> {
    return this.put(buildImported(json, this.newId(), this.now()))
  }
}
