import type { ReactNode } from 'react'
import type { ProjectRepository } from '@/core/storage'
import { ProjectRepositoryContext } from '@/app/useProjectRepository'

interface ProjectRepositoryProviderProps {
  repository: ProjectRepository
  children: ReactNode
}

/** Stellt der App das Projekt-Repository bereit (IndexedDB in der App, Memory in Tests). */
export function ProjectRepositoryProvider({
  repository,
  children,
}: ProjectRepositoryProviderProps) {
  return (
    <ProjectRepositoryContext.Provider value={repository}>
      {children}
    </ProjectRepositoryContext.Provider>
  )
}
