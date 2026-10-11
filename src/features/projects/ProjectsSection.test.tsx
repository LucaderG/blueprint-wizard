import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { computeCompleteness, PROJECT_NAME_MAX_LENGTH } from '@/core/blueprint'
import { MemoryProjectRepository } from '@/core/storage'
import { downloadTextFile } from '@/shared/lib/download'
import { renderRoute } from '@/test/render'

vi.mock('@/shared/lib/download', () => ({ downloadTextFile: vi.fn() }))

const NOW = new Date(2026, 9, 11, 14, 5)

async function repositoryWith(...names: string[]) {
  const repository = new MemoryProjectRepository({ now: () => NOW })
  for (const name of names) await repository.create(name)
  return repository
}

function projectList() {
  return screen.findByRole('list', { name: 'Projektliste' })
}

describe('Projektliste auf der Startseite', () => {
  beforeEach(() => {
    vi.mocked(downloadTextFile).mockClear()
  })

  it('zeigt einen Hinweis, wenn es noch keine Projekte gibt', async () => {
    renderRoute('/')

    expect(screen.getByRole('heading', { level: 2, name: 'Deine Projekte' })).toBeVisible()
    expect(await screen.findByText(/Du hast noch keine Projekte/)).toBeVisible()
    expect(screen.queryByRole('list', { name: 'Projektliste' })).not.toBeInTheDocument()
  })

  it('zeigt Name, Vollständigkeit und Änderungsdatum', async () => {
    const repository = await repositoryWith('Alpha')
    const [summary] = await repository.list()
    const project = (await repository.get(summary!.id))!
    project.blueprint.sections.problem.maturity = 'decided'
    project.blueprint.sections.features.maturity = 'vague'
    await repository.save(project)
    const expected = computeCompleteness(project.blueprint).total

    renderRoute('/', { repository })

    const list = await projectList()
    expect(within(list).getByRole('link', { name: 'Alpha' })).toHaveAttribute(
      'href',
      `/projekte/${project.id}`,
    )
    const bar = within(list).getByRole('progressbar', { name: 'Vollständigkeit von Alpha' })
    expect(bar).toHaveAttribute('aria-valuenow', String(expected))
    expect(expected).toBeGreaterThan(0)
    expect(within(list).getByText('Zuletzt geändert: 11.10.2026, 14:05')).toBeVisible()
  })

  it('legt ein Projekt an und öffnet es', async () => {
    const user = userEvent.setup()
    const { router, repository } = renderRoute('/')

    await user.click(await screen.findByRole('button', { name: 'Neues Projekt' }))
    const dialog = screen.getByRole('dialog', { name: 'Neues Projekt' })
    const input = within(dialog).getByLabelText('Projektname')
    expect(input).toHaveFocus()
    await user.type(input, '  Mein Projekt  ')
    await user.click(within(dialog).getByRole('button', { name: 'Anlegen' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Mein Projekt' })).toBeVisible()
    const [created] = await repository.list()
    expect(created?.name).toBe('Mein Projekt')
    expect(router.state.location.pathname).toBe(`/projekte/${created?.id}`)

    await user.click(screen.getByRole('link', { name: 'Alle Projekte' }))
    expect(within(await projectList()).getByRole('link', { name: 'Mein Projekt' })).toBeVisible()
  })

  it('prüft den Namen beim Anlegen', async () => {
    const user = userEvent.setup()
    const { repository } = renderRoute('/')

    await user.click(await screen.findByRole('button', { name: 'Neues Projekt' }))
    const dialog = screen.getByRole('dialog', { name: 'Neues Projekt' })
    const input = within(dialog).getByLabelText('Projektname')

    await user.type(input, '   ')
    await user.click(within(dialog).getByRole('button', { name: 'Anlegen' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte gib einen Namen ein.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Bitte gib einen Namen ein.')

    await user.clear(input)
    await user.click(input)
    await user.paste('x'.repeat(PROJECT_NAME_MAX_LENGTH + 1))
    await user.click(within(dialog).getByRole('button', { name: 'Anlegen' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      `Der Name darf höchstens ${PROJECT_NAME_MAX_LENGTH} Zeichen lang sein.`,
    )

    expect(await repository.list()).toHaveLength(0)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Neues Projekt' })).toHaveFocus()
  })

  it('benennt ein Projekt um', async () => {
    const user = userEvent.setup()
    renderRoute('/', { repository: await repositoryWith('Alpha') })

    await user.click(within(await projectList()).getByRole('button', { name: 'Alpha umbenennen' }))
    const dialog = screen.getByRole('dialog', { name: 'Projekt umbenennen' })
    const input = within(dialog).getByLabelText('Projektname')
    expect(input).toHaveValue('Alpha')

    await user.clear(input)
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte gib einen Namen ein.')

    await user.type(input, 'Beta')
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const list = await projectList()
    expect(within(list).getByRole('link', { name: 'Beta' })).toBeVisible()
    expect(within(list).queryByRole('link', { name: 'Alpha' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Das Projekt heißt jetzt „Beta“.')
  })

  it('bricht das Umbenennen ab, ohne etwas zu ändern', async () => {
    const user = userEvent.setup()
    renderRoute('/', { repository: await repositoryWith('Alpha') })

    await user.click(within(await projectList()).getByRole('button', { name: 'Alpha umbenennen' }))
    const dialog = screen.getByRole('dialog', { name: 'Projekt umbenennen' })
    await user.type(within(dialog).getByLabelText('Projektname'), ' neu')
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(await projectList()).getByRole('link', { name: 'Alpha' })).toBeVisible()
  })

  it('zeigt einen Fehler, wenn das umzubenennende Projekt nicht mehr existiert', async () => {
    const user = userEvent.setup()
    const repository = await repositoryWith('Alpha')
    renderRoute('/', { repository })

    await user.click(within(await projectList()).getByRole('button', { name: 'Alpha umbenennen' }))
    const [alpha] = await repository.list()
    await repository.delete(alpha!.id)
    const dialog = screen.getByRole('dialog', { name: 'Projekt umbenennen' })
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Dieses Projekt gibt es nicht mehr.',
    )
  })

  it('dupliziert ein Projekt', async () => {
    const user = userEvent.setup()
    const repository = await repositoryWith('Alpha')
    renderRoute('/', { repository })

    await user.click(within(await projectList()).getByRole('button', { name: 'Alpha duplizieren' }))

    const list = await projectList()
    expect(await within(list).findByRole('link', { name: 'Alpha (Kopie)' })).toBeVisible()
    expect(within(list).getByRole('link', { name: 'Alpha' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('„Alpha (Kopie)“ wurde angelegt.')
    expect(await repository.list()).toHaveLength(2)
  })

  it('meldet einen Fehler und aktualisiert die Liste, wenn ein Projekt fehlt', async () => {
    const user = userEvent.setup()
    const repository = await repositoryWith('Alpha')
    renderRoute('/', { repository })
    const button = within(await projectList()).getByRole('button', { name: 'Alpha duplizieren' })
    const [alpha] = await repository.list()
    await repository.delete(alpha!.id)

    await user.click(button)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dieses Projekt gibt es nicht mehr. Die Liste wurde aktualisiert.',
    )
    expect(screen.queryByRole('list', { name: 'Projektliste' })).not.toBeInTheDocument()
    expect(screen.getByText(/Du hast noch keine Projekte/)).toBeVisible()
  })

  it('löscht ein Projekt erst nach Bestätigung', async () => {
    const user = userEvent.setup()
    const repository = await repositoryWith('Alpha')
    renderRoute('/', { repository })

    await user.click(within(await projectList()).getByRole('button', { name: 'Alpha löschen' }))
    const dialog = screen.getByRole('dialog', { name: 'Projekt löschen?' })
    expect(dialog).toHaveAccessibleDescription(
      '„Alpha“ wird endgültig gelöscht. Das lässt sich nicht rückgängig machen.',
    )
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'Löschen' }))

    expect(await screen.findByText(/Du hast noch keine Projekte/)).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('„Alpha“ wurde gelöscht.')
    expect(await repository.list()).toHaveLength(0)
  })

  it('behält das Projekt, wenn das Löschen abgebrochen wird', async () => {
    const user = userEvent.setup()
    const repository = await repositoryWith('Alpha')
    renderRoute('/', { repository })

    await user.click(within(await projectList()).getByRole('button', { name: 'Alpha löschen' }))
    const dialog = screen.getByRole('dialog', { name: 'Projekt löschen?' })
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(await projectList()).getByRole('link', { name: 'Alpha' })).toBeVisible()
    expect(await repository.list()).toHaveLength(1)
  })

  it('exportiert ein Projekt als JSON-Datei', async () => {
    const user = userEvent.setup()
    const repository = await repositoryWith('Mein Café')
    renderRoute('/', { repository })

    await user.click(
      within(await projectList()).getByRole('button', { name: 'Mein Café exportieren' }),
    )

    await waitFor(() => expect(downloadTextFile).toHaveBeenCalledTimes(1))
    const [filename, content, mimeType] = vi.mocked(downloadTextFile).mock.calls[0]!
    expect(filename).toBe('mein-cafe.blueprint.json')
    expect(mimeType).toBe('application/json')
    const [summary] = await repository.list()
    expect(content).toBe(await repository.exportProject(summary!.id))
    expect(JSON.parse(content)).toMatchObject({
      format: 'blueprint-wizard/project',
      project: { id: summary!.id, name: 'Mein Café' },
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('importiert eine gültige Projektdatei', async () => {
    const user = userEvent.setup()
    const source = await repositoryWith('Importiert')
    const [summary] = await source.list()
    const json = await source.exportProject(summary!.id)
    const { repository } = renderRoute('/')

    await screen.findByText(/Du hast noch keine Projekte/)
    const file = new File([json], 'importiert.blueprint.json', { type: 'application/json' })
    const input = screen.getByLabelText<HTMLInputElement>('Projektdatei auswählen')
    await user.upload(input, file)

    expect(within(await projectList()).getByRole('link', { name: 'Importiert' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('„Importiert“ wurde importiert.')
    const [imported] = await repository.list()
    expect(imported?.id).not.toBe(summary!.id)
    expect(input.value).toBe('')
  })

  it.each([
    ['kein JSON', 'das ist kein json', 'enthält kein gültiges JSON'],
    ['fremdes JSON', '{"hallo":"welt"}', 'keine gültige Projektdatei'],
    [
      'eine neuere Version',
      JSON.stringify({ format: 'blueprint-wizard/project', project: { schemaVersion: 999 } }),
      'neueren Version des Blueprint-Wizards',
    ],
  ])('zeigt beim Import für %s eine verständliche Meldung', async (_, content, message) => {
    const user = userEvent.setup()
    const { repository } = renderRoute('/')

    await screen.findByText(/Du hast noch keine Projekte/)
    const file = new File([content], 'datei.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Projektdatei auswählen'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(await repository.list()).toHaveLength(0)
  })

  it('öffnet beim Klick auf „Projekt importieren“ die Dateiauswahl', async () => {
    const user = userEvent.setup()
    renderRoute('/')
    const input = screen.getByLabelText<HTMLInputElement>('Projektdatei auswählen')
    const click = vi.spyOn(input, 'click')

    await user.click(screen.getByRole('button', { name: 'Projekt importieren' }))

    expect(click).toHaveBeenCalled()
  })

  it('meldet, wenn die Projekte nicht geladen werden können', async () => {
    const repository = new MemoryProjectRepository()
    vi.spyOn(repository, 'list').mockRejectedValue(new Error('kaputt'))

    renderRoute('/', { repository })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Deine Projekte konnten nicht geladen werden.',
    )
  })
})
