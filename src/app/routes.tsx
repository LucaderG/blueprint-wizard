import type { RouteObject } from 'react-router'
import { ExportPage } from '@/features/export/ExportPage'
import { Layout } from '@/app/Layout'
import { NotFoundPage } from '@/app/NotFoundPage'
import { HomePage } from '@/features/home/HomePage'
import { ProjectPage } from '@/features/projects/ProjectPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { DecisionsPage } from '@/features/decisions/DecisionsPage'
import { InterviewPage } from '@/features/interview/InterviewPage'
import { EntryPage } from '@/features/wizard/EntryPage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'neu/:entryPoint', element: <EntryPage /> },
      { path: 'projekte/:projectId', element: <ProjectPage /> },
      { path: 'projekte/:projectId/export', element: <ExportPage /> },
      { path: 'projekte/:projectId/fragen', element: <InterviewPage /> },
      { path: 'projekte/:projectId/entscheidungen', element: <DecisionsPage /> },
      { path: 'einstellungen', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
