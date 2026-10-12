import { useCallback, useEffect, useState } from 'react'
import { useProjectRepository } from '@/app/useProjectRepository'
import type { Project } from '@/core/blueprint'
import type { ProjectSummary } from '@/core/storage'
import { downloadTextFile } from '@/shared/lib/download'
import { forgetUnsaved, waitForPendingSaves } from './pendingSaves'
import { exportFileName } from './projectName'

export type ProjectsStatus = 'loading' | 'ready' | 'error'

interface ProjectsState {
  status: ProjectsStatus
  projects: ProjectSummary[]
}

/**
 * Projektliste samt Aktionen. Jede ändernde Aktion lädt die Liste danach neu (auch im Fehlerfall,
 * damit z. B. ein inzwischen gelöschtes Projekt verschwindet). Fehler werden an den Aufrufer weitergereicht.
 */
export function useProjects() {
  const repository = useProjectRepository()
  const [state, setState] = useState<ProjectsState>({ status: 'loading', projects: [] })

  const reload = useCallback(async () => {
    try {
      const projects = await repository.list({ status: 'saved' })
      setState({ status: 'ready', projects })
    } catch {
      setState((current) => ({ ...current, status: 'error' }))
    }
  }, [repository])

  useEffect(() => {
    let active = true
    waitForPendingSaves(repository)
      .then(() => repository.list({ status: 'saved' }))
      .then(
        (projects) => {
          if (active) setState({ status: 'ready', projects })
        },
        () => {
          if (active) setState((current) => ({ ...current, status: 'error' }))
        },
      )
    return () => {
      active = false
    }
  }, [repository])

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

  const remove = useCallback(
    (id: string): Promise<void> =>
      withReload(async () => {
        await repository.trash(id)
        forgetUnsaved(repository, id)
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

  return { ...state, create, rename, duplicate, remove, importFile, exportProject }
}
