import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute } from '@/test/render'

describe('App', () => {
  it('zeigt auf der Startseite die drei Einstiegspunkte', () => {
    renderRoute('/')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Von der Idee zum Blueprint' }),
    ).toBeVisible()
    const entries = screen.getByRole('list', { name: 'Einstiegspunkte' })
    expect(entries.querySelectorAll('li')).toHaveLength(3)
  })

  it('navigiert über die Kopfzeile zu den Einstellungen', async () => {
    renderRoute('/')

    await userEvent.click(screen.getByRole('link', { name: 'Einstellungen' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible()
  })

  it('zeigt bei unbekannten Pfaden eine 404-Seite mit Rückweg', async () => {
    renderRoute('/gibt-es-nicht')

    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    await userEvent.click(screen.getByRole('link', { name: 'Zur Startseite' }))
    expect(
      screen.getByRole('heading', { level: 1, name: 'Von der Idee zum Blueprint' }),
    ).toBeVisible()
  })
})
