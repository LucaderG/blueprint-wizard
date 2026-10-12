import type { Project } from '@/core/blueprint'
import type { ProjectRepository } from '@/core/storage'

/**
 * Laufende Speichervorgänge je Repository. Wer ein Projekt lädt, wartet vorher darauf, damit eine
 * Seite nach schnellem Wechsel nicht den Stand von vor dem letzten Speichern anzeigt (und ihn später
 * zurückschreibt).
 */
const pending = new WeakMap<ProjectRepository, Set<Promise<unknown>>>()

export function trackSave(repository: ProjectRepository, save: Promise<unknown>): void {
  let saves = pending.get(repository)
  if (!saves) {
    saves = new Set()
    pending.set(repository, saves)
  }
  saves.add(save)
  const remove = () => saves.delete(save)
  save.then(remove, remove)
}

/** Wartet, bis alle bis jetzt begonnenen Speichervorgänge abgeschlossen sind (auch fehlgeschlagene). */
export async function waitForPendingSaves(repository: ProjectRepository): Promise<void> {
  await Promise.allSettled([...(pending.get(repository) ?? [])])
}

/**
 * Stände, deren Speichern fehlgeschlagen ist, je Repository und Projekt-ID. Die nächste Seite, die
 * das Projekt lädt, übernimmt sie statt des älteren gespeicherten Stands und zeigt den Fehler weiter
 * an. Sie leben nur im Arbeitsspeicher, bis ein Speichern gelingt.
 */
const unsaved = new WeakMap<ProjectRepository, Map<string, Project>>()

export function rememberUnsaved(repository: ProjectRepository, project: Project): void {
  let projects = unsaved.get(repository)
  if (!projects) {
    projects = new Map()
    unsaved.set(repository, projects)
  }
  projects.set(project.id, project)
}

export function forgetUnsaved(repository: ProjectRepository, id: string): void {
  unsaved.get(repository)?.delete(id)
}

export function getUnsaved(repository: ProjectRepository, id: string): Project | undefined {
  return unsaved.get(repository)?.get(id)
}
