import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SECTION_IDS } from '@/core/blueprint'
import { MemoryProjectRepository } from '@/core/storage'
import { renderRoute } from '@/test/render'

const SECTION_NAMES = [
  'Problem & Vision',
  'Zielgruppe & Nutzer',
  'Kernfunktionen (MVP)',
  'Nicht-Ziele',
  'Nutzerabläufe & Screens',
  'Datenmodell',
  'Tech-Stack & Plattform',
  'Integrationen & externe Dienste',
  'Risiken & offene Punkte',
  'Umsetzungs-Roadmap',
]

describe('Projektseite', () => {
  it('zeigt Name, Vollständigkeit und alle Abschnitte mit Reifegrad', async () => {
    const repository = new MemoryProjectRepository()
    const project = await repository.create('Alpha')
    project.blueprint.sections.problem.maturity = 'decided'
    project.blueprint.sections.audience.maturity = 'vague'
    await repository.save(project)

    renderRoute(`/projekte/${project.id}`, { repository })

    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeVisible()
    expect(screen.getByRole('progressbar', { name: 'Vollständigkeit' })).toHaveAttribute(
      'aria-valuenow',
      '24',
    )
    const items = within(screen.getByRole('list', { name: 'Abschnitte' })).getAllByRole('listitem')
    expect(items).toHaveLength(SECTION_IDS.length)
    SECTION_NAMES.forEach((name, index) => expect(items[index]).toHaveTextContent(name))
    expect(items[0]).toHaveTextContent('Reifegrad: entschieden')
    expect(items[1]).toHaveTextContent('Reifegrad: vage')
    expect(items[2]).toHaveTextContent('Reifegrad: leer')
    expect(screen.getByText(/in einer der nächsten Ausbaustufen/)).toBeVisible()
  })

  it('führt zurück zur Projektliste', async () => {
    const user = userEvent.setup()
    const repository = new MemoryProjectRepository()
    const project = await repository.create('Alpha')
    const { router } = renderRoute(`/projekte/${project.id}`, { repository })

    await user.click(await screen.findByRole('link', { name: 'Alle Projekte' }))

    expect(router.state.location.pathname).toBe('/')
    expect(await screen.findByRole('link', { name: 'Alpha' })).toBeVisible()
  })

  it('zeigt einen Hinweis, wenn es das Projekt nicht gibt', async () => {
    const user = userEvent.setup()
    renderRoute('/projekte/gibt-es-nicht')

    expect(await screen.findByRole('heading', { name: 'Projekt nicht gefunden' })).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Zur Startseite' }))
    expect(
      screen.getByRole('heading', { level: 1, name: 'Von der Idee zum Blueprint' }),
    ).toBeVisible()
  })

  it('meldet, wenn das Projekt nicht geladen werden kann', async () => {
    const repository = new MemoryProjectRepository()
    vi.spyOn(repository, 'get').mockRejectedValue(new Error('kaputt'))

    renderRoute('/projekte/egal', { repository })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Das Projekt konnte nicht geladen werden.',
    )
  })
})
