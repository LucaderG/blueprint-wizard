import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute } from '@/test/render'

describe('Darstellung', () => {
  it('schaltet die Oberfläche auf Englisch und zurück', async () => {
    const user = userEvent.setup()
    renderRoute('/einstellungen')

    await user.selectOptions(screen.getByLabelText('Sprache der Oberfläche'), 'en')

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    expect(document.documentElement.lang).toBe('en')

    await user.selectOptions(screen.getByLabelText('Interface language'), 'de')
    expect(await screen.findByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible()
    expect(document.documentElement.lang).toBe('de')
  })

  it('setzt das dunkle Farbschema fest und folgt sonst dem System', async () => {
    const user = userEvent.setup()
    renderRoute('/einstellungen')

    await user.click(screen.getByRole('radio', { name: 'Dunkel' }))
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))

    await user.click(screen.getByRole('radio', { name: 'Hell' }))
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'))

    await user.click(screen.getByRole('radio', { name: 'Wie das System' }))
    expect(screen.getByRole('radio', { name: 'Wie das System' })).toBeChecked()
  })

  it('startet mit gespeicherter englischer Oberfläche', async () => {
    renderRoute('/einstellungen', { settings: { uiLanguage: 'en' } })
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  })
})
