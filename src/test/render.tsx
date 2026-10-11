import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ProjectRepositoryProvider } from '@/app/ProjectRepositoryContext'
import { routes } from '@/app/routes'
import { MemoryProjectRepository, type ProjectRepository } from '@/core/storage'

interface RenderRouteOptions {
  /** Repository für den Test; Standard ist ein frisches, leeres `MemoryProjectRepository`. */
  repository?: ProjectRepository
}

/** Rendert die App mit allen Routen an einer bestimmten URL. */
export function renderRoute(
  path = '/',
  { repository = new MemoryProjectRepository() }: RenderRouteOptions = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return {
    router,
    repository,
    ...render(
      <ProjectRepositoryProvider repository={repository}>
        <RouterProvider router={router} />
      </ProjectRepositoryProvider>,
    ),
  }
}
