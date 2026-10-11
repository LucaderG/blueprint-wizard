import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import '@/shared/i18n'
import { server } from './msw/server'

// Jeder nicht gemockte Netzwerkaufruf lässt den Test fehlschlagen: Tests rufen nie echte APIs auf.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())
