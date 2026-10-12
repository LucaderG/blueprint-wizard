import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import i18n from '@/shared/i18n'
import { server } from './msw/server'

// Jeder nicht gemockte Netzwerkaufruf lässt den Test fehlschlagen: Tests rufen nie echte APIs auf.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  // Ein Test mit englischer Oberfläche darf die folgenden nicht beeinflussen.
  if (i18n.language !== 'de') void i18n.changeLanguage('de')
  document.documentElement.classList.remove('dark')
  // Sitzungsdaten (Kostenanzeige, Ideenfindung) gelten nur für einen Test.
  sessionStorage.clear()
})
afterAll(() => server.close())
