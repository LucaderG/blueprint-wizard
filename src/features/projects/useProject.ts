import { useEffect, useState } from 'react'
import { useProjectRepository } from '@/app/useProjectRepository'
import type { Project } from '@/core/blueprint'

export type ProjectState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'ready'; project: Project }

type Result = { id: string } & ProjectState

/** Lädt ein einzelnes Projekt. Wechselt die ID, gilt der alte Stand sofort als veraltet. */
export function useProject(id: string): ProjectState {
  const repository = useProjectRepository()
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let active = true
    repository.get(id).then(
      (project) => {
        if (active)
          setResult(project ? { id, status: 'ready', project } : { id, status: 'notFound' })
      },
      () => {
        if (active) setResult({ id, status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [id, repository])

  if (!result || result.id !== id) return { status: 'loading' }
  return result
}
