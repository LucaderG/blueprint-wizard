import { createBrowserRouter } from 'react-router'
import { routes } from '@/app/routes'

// Unter GitHub Pages liegt die App in einem Unterordner (BASE_URL z. B. „/blueprint-wizard/“).
export const router = createBrowserRouter(routes, {
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
})
