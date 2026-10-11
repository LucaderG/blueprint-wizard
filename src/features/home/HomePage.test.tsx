import { screen, within } from '@testing-library/react'
import { renderRoute } from '@/test/render'

describe('Einstiegskarten auf der Startseite', () => {
  it('verlinkt jede Karte auf ihren Einstieg', () => {
    renderRoute('/')

    const entries = screen.getByRole('list', { name: 'Einstiegspunkte' })
    expect(within(entries).getByRole('link', { name: 'Ich habe keine Idee' })).toHaveAttribute(
      'href',
      '/neu/keine-idee',
    )
    expect(within(entries).getByRole('link', { name: 'Ich habe eine Teil-Idee' })).toHaveAttribute(
      'href',
      '/neu/teil-idee',
    )
    expect(within(entries).getByRole('link', { name: 'Ich habe fast alles' })).toHaveAttribute(
      'href',
      '/neu/fast-fertig',
    )
  })

  it('zeigt keinen Hinweis mehr, dass der Wizard in Arbeit ist', () => {
    renderRoute('/')

    expect(screen.queryByText(/in Arbeit/)).not.toBeInTheDocument()
  })
})
