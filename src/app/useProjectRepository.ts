import { createContext, useContext } from 'react'
import type { ProjectRepository } from '@/core/storage'

export const ProjectRepositoryContext = createContext<ProjectRepository | null>(null)

/** Liefert das Projekt-Repository aus dem `ProjectRepositoryProvider`. */
export function useProjectRepository(): ProjectRepository {
  const repository = useContext(ProjectRepositoryContext)
  if (!repository) {
    throw new Error('useProjectRepository braucht einen umschließenden ProjectRepositoryProvider')
  }
  return repository
}
