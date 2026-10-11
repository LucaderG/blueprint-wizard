import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/test/msw/server'
import { openRouterHandlers } from '@/test/msw/openrouter'
import { renderRoute } from '@/test/render'

describe('Abschnitt Antworten', () => {
  beforeEach(() => {
    server.use(...openRouterHandlers)
  })

  it('speichert die Temperatur sofort und zeigt sie an', () => {
    const { settingsStore } = renderRoute('/einstellungen')

    const slider = screen.getByRole('slider', { name: 'Kreativität (Temperatur)' })
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '2')
    expect(slider).toHaveAttribute('step', '0.1')
    expect(slider).toHaveAccessibleDescription('0 = vorhersehbar, 2 = sehr kreativ')
    expect(screen.getByText('0,7')).toBeVisible()

    fireEvent.change(slider, { target: { value: '1.2' } })

    expect(settingsStore.load().temperature).toBe(1.2)
    expect(screen.getByText('1,2')).toBeVisible()
    expect(screen.getByText('Gespeichert')).toBeVisible()
  })

  it('speichert die Antwortsprache sofort', async () => {
    const user = userEvent.setup()
    const { settingsStore } = renderRoute('/einstellungen')

    const language = screen.getByRole('combobox', { name: 'Antwortsprache' })
    expect(language).toHaveValue('de')
    await user.selectOptions(language, 'en')

    expect(settingsStore.load().outputLanguage).toBe('en')
    expect(language).toHaveValue('en')
  })
})
