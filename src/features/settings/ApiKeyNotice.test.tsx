import { screen } from '@testing-library/react'
import { VALID_TEST_KEY } from '@/test/msw/openrouter'
import { renderRoute } from '@/test/render'

describe('ApiKeyNotice auf der Startseite', () => {
  it('zeigt den Hinweis ohne hinterlegten Key und führt zu den Einstellungen', async () => {
    renderRoute('/')

    expect(
      await screen.findByText('Für die KI-Funktionen brauchst du einen OpenRouter-API-Key.'),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Zu den Einstellungen' })).toHaveAttribute(
      'href',
      '/einstellungen',
    )
  })

  it('ist mit hinterlegtem Key nicht zu sehen', async () => {
    renderRoute('/', { settings: { apiKey: VALID_TEST_KEY } })

    expect(await screen.findByRole('heading', { level: 2, name: 'Deine Bibliothek' })).toBeVisible()
    expect(screen.queryByText(/Für die KI-Funktionen/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Zu den Einstellungen' })).not.toBeInTheDocument()
  })
})
