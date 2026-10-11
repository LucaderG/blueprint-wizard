import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { AiProviderFactory } from '@/app/ai'
import { ProjectRepositoryProvider } from '@/app/ProjectRepositoryContext'
import { routes } from '@/app/routes'
import { SettingsProvider } from '@/app/SettingsProvider'
import { MockAiProvider } from '@/core/ai'
import { SettingsStore, type Settings } from '@/core/settings'
import { MemoryProjectRepository, type ProjectRepository } from '@/core/storage'
import { MemoryStorage } from './memoryStorage'

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
  const router = createMemoryRouter(routes, { initialEntries: [path] })
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
