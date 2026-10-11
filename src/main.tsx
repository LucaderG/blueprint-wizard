import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { createDefaultSettingsStore } from '@/app/ai'
import { ProjectRepositoryProvider } from '@/app/ProjectRepositoryContext'
import { createDefaultRepository } from '@/app/repository'
import { router } from '@/app/router'
import { SettingsProvider } from '@/app/SettingsProvider'
import i18n from '@/shared/i18n'
import './index.css'

const repository = createDefaultRepository()
const settingsStore = createDefaultSettingsStore()
// Gespeicherte Sprache vor dem ersten Rendern setzen, damit keine falsche Sprache aufblitzt.
void i18n.changeLanguage(settingsStore.load().uiLanguage)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider store={settingsStore}>
      <ProjectRepositoryProvider repository={repository}>
        <RouterProvider router={router} />
      </ProjectRepositoryProvider>
    </SettingsProvider>
  </StrictMode>,
)
