import { useCallback, useEffect, useState } from 'react'
import { useProjectRepository } from '@/app/useProjectRepository'
import { useSettings } from '@/app/useSettings'
import type { Project } from '@/core/blueprint'
import type { ProjectRepository, ProjectSummary } from '@/core/storage'
import { downloadTextFile } from '@/shared/lib/download'
import { forgetUnsaved, waitForPendingSaves } from './pendingSaves'
import { exportFileName } from './projectName'

export type ProjectsStatus = 'loading' | 'ready' | 'error'

interface ProjectsState {
  status: ProjectsStatus
  /** Einträge der Bibliothek, zuletzt geänderte zuerst. */
  projects: ProjectSummary[]
  /** Einträge im Papierkorb. */
  trashed: ProjectSummary[]
}

async function loadAll(repository: ProjectRepository) {
  const [projects, trashed] = await Promise.all([
    repository.list({ status: 'saved' }),
    repository.list({ status: 'trashed' }),
  ])
  return { projects, trashed }
}

/**
 * Bibliothek und Papierkorb samt Aktionen. Beim ersten Laden räumt der Hook abgelaufene Einträge aus
 * dem Papierkorb weg (Frist aus den Einstellungen). Jede ändernde Aktion lädt danach neu (auch im
 * Fehlerfall, damit z. B. ein inzwischen gelöschtes Projekt verschwindet). Fehler werden an den
 * Aufrufer weitergereicht.
 */
export function useProjects() {
  const repository = useProjectRepository()
  const { settings } = useSettings()
  const retentionDays = settings.trashRetentionDays
  const [state, setState] = useState<ProjectsState>({
    status: 'loading',
    projects: [],
    trashed: [],
  })

  const reload = useCallback(async () => {
    try {
      setState({ status: 'ready', ...(await loadAll(repository)) })
    } catch {
      setState((current) => ({ ...current, status: 'error' }))
    }
  }, [repository])

  useEffect(() => {
    let active = true
    waitForPendingSaves(repository)
      .then(async () => {
        try {
          const purged = await repository.purgeExpired(new Date(), retentionDays)
          for (const id of purged) forgetUnsaved(repository, id)
        } catch {
          // Scheitert das Aufräumen, bleiben die Einträge eben bis zum nächsten Mal liegen.
        }
        return loadAll(repository)
      })
      .then(
        (lists) => {
          if (active) setState({ status: 'ready', ...lists })
        },
        () => {
          if (active) setState((current) => ({ ...current, status: 'error' }))
        },
      )
    return () => {
      active = false
    }
  }, [repository, retentionDays])

  const withReload = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      try {
        return await operation()
      } finally {
        await reload()
      }
    },
    [reload],
  )

  const create = useCallback(
    (name: string): Promise<Project> => withReload(() => repository.create(name)),
    [repository, withReload],
  )

  const rename = useCallback(
    (id: string, name: string): Promise<Project> => withReload(() => repository.rename(id, name)),
    [repository, withReload],
  )

  const duplicate = useCallback(
    (id: string): Promise<Project> => withReload(() => repository.duplicate(id)),
    [repository, withReload],
  )

  /** Legt einen Eintrag in den Papierkorb. */
  const trash = useCallback(
    (id: string): Promise<Project> =>
      withReload(async () => {
        const trashed = await repository.trash(id)
        forgetUnsaved(repository, id)
        return trashed
      }),
    [repository, withReload],
  )

  /** Holt einen Eintrag aus dem Papierkorb in die Bibliothek („Speichern“, „Rückgängig“). */
  const restore = useCallback(
    (id: string): Promise<Project> => withReload(() => repository.restore(id)),
    [repository, withReload],
  )

  const deleteForever = useCallback(
    (id: string): Promise<void> =>
      withReload(async () => {
        await repository.deleteForever(id)
        forgetUnsaved(repository, id)
      }),
    [repository, withReload],
  )

  /** Leert den Papierkorb endgültig. */
  const emptyTrash = useCallback(
    (): Promise<void> =>
      withReload(async () => {
        const trashed = await repository.list({ status: 'trashed' })
        for (const { id } of trashed) {
          await repository.deleteForever(id)
          forgetUnsaved(repository, id)
        }
      }),
    [repository, withReload],
  )

  const importFile = useCallback(
    (file: Blob): Promise<Project> =>
      withReload(async () => repository.importProject(await file.text())),
    [repository, withReload],
  )

  const exportProject = useCallback(
    async ({ id, name }: Pick<ProjectSummary, 'id' | 'name'>): Promise<void> => {
      const json = await repository.exportProject(id)
      downloadTextFile(exportFileName(name), json, 'application/json')
    },
    [repository],
  )

  return {
    ...state,
    retentionDays,
    create,
    rename,
    duplicate,
    trash,
    restore,
    deleteForever,
    emptyTrash,
    importFile,
    exportProject,
  }
}
