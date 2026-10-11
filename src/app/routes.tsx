import type { RouteObject } from 'react-router'
import { Layout } from '@/app/Layout'
import { NotFoundPage } from '@/app/NotFoundPage'
import { HomePage } from '@/features/home/HomePage'
import { ProjectPage } from '@/features/projects/ProjectPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'projekte/:projectId', element: <ProjectPage /> },
      { path: 'einstellungen', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
