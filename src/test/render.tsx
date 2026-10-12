import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import type { AiProviderFactory } from '@/app/ai'
import { ProjectRepositoryProvider } from '@/app/ProjectRepositoryContext'
import { routes } from '@/app/routes'
import { SettingsProvider } from '@/app/SettingsProvider'
import { MockAiProvider } from '@/core/ai'
import { SettingsStore, type Settings } from '@/core/settings'
import { MemoryProjectRepository, type ProjectRepository } from '@/core/storage'
import { MemoryStorage } from './memoryStorage'

/**
 * Die App lädt Seiten per `lazy`. In Tests werden sie vorab aufgelöst, damit Seiten sofort nach dem
 * Rendern abfragbar sind wie bisher. Das Laden selbst prüfen die E2E-Tests im echten Build.
 */
async function resolveLazyRoutes(list: RouteObject[]): Promise<RouteObject[]> {
  return Promise.all(
    list.map(async (route): Promise<RouteObject> => {
      const { lazy, children, ...rest } = route
      const loaded = typeof lazy === 'function' ? await lazy() : {}
      const resolved = { ...rest, ...loaded } as RouteObject
      return children
        ? ({ ...resolved, children: await resolveLazyRoutes(children) } as RouteObject)
        : resolved
    }),
  )
}

const testRoutes = await resolveLazyRoutes(routes)

interface RenderRouteOptions {
  /** Repository für den Test; Standard ist ein frisches, leeres `MemoryProjectRepository`. */
  repository?: ProjectRepository
  /** Start-Einstellungen; Standard sind die App-Standards ohne API-Key. */
  settings?: Partial<Settings>
  /** KI-Anbieter, der bei hinterlegtem Key verwendet wird; Standard ist ein leerer `MockAiProvider`. */
  aiProvider?: MockAiProvider
}

/** Rendert die App mit allen Routen an einer bestimmten URL. */
export function renderRoute(
  path = '/',
  {
    repository = new MemoryProjectRepository(),
    settings,
    aiProvider = new MockAiProvider(),
  }: RenderRouteOptions = {},
) {
  const settingsStore = new SettingsStore(new MemoryStorage())
  if (settings) settingsStore.update(settings)
  const createAiProvider: AiProviderFactory = () => aiProvider
  const router = createMemoryRouter(testRoutes, { initialEntries: [path] })
  return {
    router,
    repository,
    settingsStore,
    aiProvider,
    ...render(
      <SettingsProvider store={settingsStore} createAiProvider={createAiProvider}>
        <ProjectRepositoryProvider repository={repository}>
          <RouterProvider router={router} />
        </ProjectRepositoryProvider>
      </SettingsProvider>,
    ),
  }
}
