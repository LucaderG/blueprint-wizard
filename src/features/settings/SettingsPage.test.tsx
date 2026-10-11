import { screen } from '@testing-library/react'
import { server } from '@/test/msw/server'
import { openRouterHandlers } from '@/test/msw/openrouter'
import { renderRoute } from '@/test/render'

describe('Einstellungsseite', () => {
  beforeEach(() => {
    server.use(...openRouterHandlers)
  })

  it('zeigt alle drei Abschnitte unter der Hauptüberschrift', () => {
    renderRoute('/einstellungen')

    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'OpenRouter-API-Key' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Modell' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Antworten' })).toBeVisible()
  })
})
