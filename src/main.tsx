import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { ProjectRepositoryProvider } from '@/app/ProjectRepositoryContext'
import { createDefaultRepository } from '@/app/repository'
import { router } from '@/app/router'
import '@/shared/i18n'
import './index.css'

const repository = createDefaultRepository()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProjectRepositoryProvider repository={repository}>
      <RouterProvider router={router} />
    </ProjectRepositoryProvider>
  </StrictMode>,
)
