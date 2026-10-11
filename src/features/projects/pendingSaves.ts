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
