import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiError, MockAiProvider, type VariantCandidate } from '@/core/ai'
import { MemoryProjectRepository } from '@/core/storage'
import { VALID_TEST_KEY } from '@/test/msw/openrouter'
import { renderRoute } from '@/test/render'
import { readVariantsSession, VARIANTS_STORAGE_KEY } from './variantsSession'

const aiSettings = { apiKey: VALID_TEST_KEY }
const IDEA = 'Eine App für Fans einer Band'

function candidate(title: string): VariantCandidate {
  return {
    title,
    pitch: `Worum es bei ${title} geht.`,
    problem: 'Fans verpassen Konzerte.',
    audience: 'Fans einer Band',
    features: ['Tourdaten', 'Setlisten', 'Treffpunkte', 'Fotos teilen', 'Erinnerungen'],
    platform: 'Smartphone-App',
    monetization: { model: 'Freemium', priceRange: '2–4 € pro Monat', reason: 'Niedrige Hürde.' },
    effort: 'medium',
    risks: ['Rechte an Fotos', 'Wenig Nutzer'],
  }
}

const variantsJson = (...titles: string[]) =>
  JSON.stringify({ variants: titles.map((title) => candidate(title)) })

const EXPANSION = JSON.stringify({
  projectName: null,
  summary: 'Ausgearbeitet.',
  sections: [
    { id: 'problem', content: 'Fans verpassen Konzerte ihrer Band.', maturity: 'decided' },
    { id: 'audience', content: 'Fans, die oft auf Konzerte gehen.', maturity: 'decided' },
  ],
})

const variantList = () => screen.getByRole('list', { name: 'Varianten' })
const card = (name: string) => screen.getByRole('article', { name })

async function generateFromForm(aiProvider: MockAiProvider, count = 1) {
  const user = userEvent.setup()
  const rendered = renderRoute('/neu/teil-idee', { settings: aiSettings, aiProvider })
  await user.type(screen.getByLabelText('Beschreib deine Idee'), IDEA)
  await user.selectOptions(screen.getByLabelText('Anzahl Varianten'), String(count))
  await user.click(screen.getByRole('button', { name: 'Varianten erzeugen' }))
  return { user, ...rendered }
}

describe('Varianten erzeugen im Einstieg „Teil-Idee“', () => {
  it('legt die Steckbriefe im Papierkorb an und öffnet die Variantenseite', async () => {
    const aiProvider = new MockAiProvider([variantsJson('Tourbegleiter', 'Setlist-Archiv')])
    const { router, repository } = await generateFromForm(aiProvider, 2)

    expect(await screen.findByRole('heading', { level: 1, name: 'Deine Varianten' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/varianten')
    await screen.findByRole('list', { name: 'Varianten' })
    expect(within(variantList()).getAllByRole('article')).toHaveLength(2)
    expect(
      within(card('Tourbegleiter')).getByText('Worum es bei Tourbegleiter geht.'),
    ).toBeVisible()
    expect(within(card('Tourbegleiter')).getByText('Im Papierkorb, noch 24 Std.')).toBeVisible()

    expect(await repository.list({ status: 'saved' })).toEqual([])
    const trashed = await repository.list({ status: 'trashed' })
    expect(trashed.map((entry) => entry.name).sort()).toEqual(['Setlist-Archiv', 'Tourbegleiter'])
    expect(trashed.every((entry) => entry.hasProfile)).toBe(true)
    expect(readVariantsSession()).toMatchObject({ idea: IDEA, count: 2 })
    expect(aiProvider.requests[0]?.messages.at(-1)?.content).toContain(IDEA)
  })

  it('zeigt die Auswahl nur im Einstieg „Teil-Idee“', () => {
    renderRoute('/neu/fast-fertig', { settings: aiSettings })
    expect(screen.queryByRole('button', { name: 'Varianten erzeugen' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Anzahl Varianten')).not.toBeInTheDocument()
  })

  it('erzeugt standardmäßig eine Variante und sperrt den Knopf ohne Key', () => {
    renderRoute('/neu/teil-idee')
    expect(screen.getByLabelText('Anzahl Varianten')).toHaveValue('1')
    expect(screen.getByRole('button', { name: 'Varianten erzeugen' })).toBeDisabled()
  })

  it('meldet KI-Fehler und legt keine Einträge an', async () => {
    const aiProvider = new MockAiProvider([new AiError('invalidKey', 'Ungültig', { status: 401 })])
    const { repository } = await generateFromForm(aiProvider)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der API-Key ist ungültig oder wurde widerrufen.',
    )
    expect(await repository.list({ status: 'trashed' })).toEqual([])
  })

  it('meldet eine Antwort ohne brauchbaren Steckbrief als unerwartetes Format', async () => {
    const aiProvider = new MockAiProvider([JSON.stringify({ variants: [] })])
    await generateFromForm(aiProvider)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die Antwort der KI hatte ein unerwartetes Format.',
    )
  })
})

describe('Variantenseite', () => {
  it('zeigt ohne erzeugte Varianten einen Hinweis', () => {
    renderRoute('/varianten')
    expect(
      screen.getByText('Hier erscheinen Varianten, sobald du sie aus einer Idee erzeugst.'),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Idee eingeben' })).toHaveAttribute(
      'href',
      '/neu/teil-idee',
    )
  })

  it('speichert eine Variante in der Bibliothek', async () => {
    const aiProvider = new MockAiProvider([variantsJson('Tourbegleiter')])
    const user = userEvent.setup()
    const { repository } = await generateFromForm(aiProvider)
    await screen.findByRole('list', { name: 'Varianten' })

    await user.click(screen.getByRole('button', { name: 'Tourbegleiter speichern' }))

    expect(
      await within(card('Tourbegleiter')).findByText('In der Bibliothek gespeichert'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tourbegleiter speichern' })).toBeDisabled()
    const [saved] = await repository.list({ status: 'saved' })
    expect(saved?.name).toBe('Tourbegleiter')
  })

  it('arbeitet einen Steckbrief voll aus und speichert ihn', async () => {
    const aiProvider = new MockAiProvider([variantsJson('Tourbegleiter'), EXPANSION])
    const user = userEvent.setup()
    const { repository } = await generateFromForm(aiProvider)
    await screen.findByRole('list', { name: 'Varianten' })

    await user.click(screen.getByRole('button', { name: 'Tourbegleiter voll ausarbeiten' }))

    expect(
      await within(card('Tourbegleiter')).findByRole('progressbar', {
        name: 'Vollständigkeit von Tourbegleiter',
      }),
    ).toBeVisible()
    const [saved] = await repository.list({ status: 'saved' })
    const project = await repository.get(saved!.id)
    expect(project?.blueprint.sections.problem).toMatchObject({
      content: 'Fans verpassen Konzerte ihrer Band.',
      source: 'aiSuggestion',
    })
    expect(project?.profile?.pitch).toBe('Worum es bei Tourbegleiter geht.')
  })

  it('meldet Fehler beim Ausarbeiten auf der Karte', async () => {
    const aiProvider = new MockAiProvider([
      variantsJson('Tourbegleiter'),
      new AiError('rateLimited', 'Zu viele', { status: 429 }),
    ])
    const user = userEvent.setup()
    await generateFromForm(aiProvider)
    await screen.findByRole('list', { name: 'Varianten' })

    await user.click(screen.getByRole('button', { name: 'Tourbegleiter voll ausarbeiten' }))

    expect(await within(card('Tourbegleiter')).findByRole('alert')).toBeVisible()
  })

  it('ersetzt die Anzeige beim Neu-Erzeugen; die alten Varianten bleiben im Papierkorb', async () => {
    const aiProvider = new MockAiProvider([
      variantsJson('Tourbegleiter'),
      variantsJson('Fanclub-Planer', 'Konzert-Tagebuch'),
    ])
    const user = userEvent.setup()
    const { repository } = await generateFromForm(aiProvider)
    await screen.findByRole('list', { name: 'Varianten' })

    await user.selectOptions(screen.getByLabelText('Anzahl Varianten'), '2')
    await user.click(screen.getByRole('button', { name: 'Neu erzeugen' }))

    expect(await screen.findByRole('article', { name: 'Fanclub-Planer' })).toBeVisible()
    expect(screen.queryByRole('article', { name: 'Tourbegleiter' })).not.toBeInTheDocument()
    expect(within(variantList()).getAllByRole('article')).toHaveLength(2)
    const trashed = await repository.list({ status: 'trashed' })
    expect(trashed.map((entry) => entry.name).sort()).toEqual([
      'Fanclub-Planer',
      'Konzert-Tagebuch',
      'Tourbegleiter',
    ])
  })

  it('zeigt ohne Key den Hinweis und sperrt Neu-Erzeugen und Ausarbeiten', async () => {
    const repository = new MemoryProjectRepository()
    const entry = await repository.create('Tourbegleiter')
    await repository.save({ ...entry, profile: { ...candidate('x'), pitch: 'Begleitet Fans.' } })
    await repository.trash(entry.id)
    sessionStorage.setItem(
      VARIANTS_STORAGE_KEY,
      JSON.stringify({ idea: IDEA, count: 1, ids: [entry.id, 'weg'] }),
    )

    renderRoute('/varianten', { repository })

    expect(await screen.findByRole('article', { name: 'Tourbegleiter' })).toBeVisible()
    expect(within(variantList()).getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Zu den Einstellungen' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Neu erzeugen' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tourbegleiter voll ausarbeiten' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Tourbegleiter öffnen' })).toHaveAttribute(
      'href',
      `/projekte/${entry.id}`,
    )
  })

  it('meldet, wenn alle Varianten inzwischen gelöscht sind', async () => {
    sessionStorage.setItem(
      VARIANTS_STORAGE_KEY,
      JSON.stringify({ idea: IDEA, count: 1, ids: ['weg'] }),
    )
    renderRoute('/varianten')
    expect(
      await screen.findByText(
        'Diese Varianten gibt es nicht mehr. Erzeuge neue oder schau in der Bibliothek nach.',
      ),
    ).toBeVisible()
  })

  it('ignoriert einen ungültigen Stand im sessionStorage', () => {
    sessionStorage.setItem(VARIANTS_STORAGE_KEY, '{kaputt')
    renderRoute('/varianten')
    expect(
      screen.getByText('Hier erscheinen Varianten, sobald du sie aus einer Idee erzeugst.'),
    ).toBeVisible()
  })
})
