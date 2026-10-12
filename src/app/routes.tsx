import type { RouteObject } from 'react-router'
import { Layout } from '@/app/Layout'
import { NotFoundPage } from '@/app/NotFoundPage'
import { RouteError, RouteLoading } from '@/app/RouteStates'
import { HomePage } from '@/features/home/HomePage'

// Startseite und Rahmen laden sofort, alle anderen Seiten erst bei Bedarf (kleineres Start-Bundle).
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <RouteLoading />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'neu/:entryPoint',
        lazy: () => import('@/features/wizard/EntryPage').then((m) => ({ Component: m.EntryPage })),
      },
      {
        path: 'projekte/:projectId',
        lazy: () =>
          import('@/features/projects/ProjectPage').then((m) => ({ Component: m.ProjectPage })),
      },
      {
        path: 'projekte/:projectId/fragen',
        lazy: () =>
          import('@/features/interview/InterviewPage').then((m) => ({
            Component: m.InterviewPage,
          })),
      },
      {
        path: 'projekte/:projectId/entscheidungen',
        lazy: () =>
          import('@/features/decisions/DecisionsPage').then((m) => ({
            Component: m.DecisionsPage,
          })),
      },
      {
        path: 'projekte/:projectId/monetarisierung',
        lazy: () =>
          import('@/features/monetization/MonetizationPage').then((m) => ({
            Component: m.MonetizationPage,
          })),
      },
      {
        path: 'projekte/:projectId/export',
        lazy: () =>
          import('@/features/export/ExportPage').then((m) => ({ Component: m.ExportPage })),
      },
      {
        path: 'einstellungen',
        lazy: () =>
          import('@/features/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
