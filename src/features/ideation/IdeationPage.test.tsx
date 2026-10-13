import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiError, MockAiProvider, type CompletionRequest } from '@/core/ai'
import { MemoryProjectRepository } from '@/core/storage'
import { VALID_TEST_KEY } from '@/test/msw/openrouter'
import { renderRoute } from '@/test/render'
import { IDEATION_STORAGE_KEY } from './useIdeation'

const ROUTE = '/neu/keine-idee'
const aiSettings = { apiKey: VALID_TEST_KEY }

const FRUSTRATION = 'Ich vergesse ständig, wem ich was geliehen habe.'
const LEARNING_GOAL = 'Meine erste App veröffentlichen.'

/** Kandidat im Schema der KI-Antwort (`ideaCandidateSchema`); Felder lassen sich überschreiben. */
function candidate(title: string, overrides: Record<string, unknown> = {}) {
  return {
    title,
    pitch: `${title} hilft im Alltag.`,
    problem: `Problem von ${title}.`,
    audience: 'Studierende',
    features: ['Erste Funktion', 'Zweite Funktion', 'Dritte Funktion'],
    platform: 'Web-App im Browser',
    effort: 'small',
    novelty: 3,
    learningValue: 4,
    learningNote: `Man lernt viel über ${title}.`,
    ...overrides,
  }
}

/** Antwort der KI mit den genannten Ideen. */
const ideasAnswer = (...titles: string[]) =>
  JSON.stringify({ ideas: titles.map((title) => candidate(title)) })

/** Antwort, die erst mit dem Abbruch des Signals endet, so wie der echte Provider. */
class PendingProvider extends MockAiProvider {
  override complete(request: CompletionRequest) {
    return new Promise<never>((_resolve, reject) => {
      const abort = () => reject(new AiError('aborted', 'Anfrage abgebrochen'))
      if (request.signal?.aborted) return abort()
      request.signal?.addEventListener('abort', abort)
    })
  }
}

/** Letzte Nachricht einer Anfrage (der Aufgabenteil des Prompts). */
const lastMessage = (request: CompletionRequest | undefined) =>
  request?.messages.at(-1)?.content ?? ''

/** Titel der Ideenkarten in Anzeigereihenfolge. */
const cardTitles = () =>
  screen
    .getAllByRole('article')
    .map((article) => within(article).getByRole('heading', { level: 3 }).textContent)

const card = (title: string) => screen.getByRole('article', { name: title })
const findsIdeasButton = () => screen.getByRole('button', { name: 'Ideen finden' })

const addInterests = async (user: ReturnType<typeof userEvent.setup>, text: string) =>
  user.type(screen.getByLabelText('Was interessiert dich? hinzufügen'), `${text}{Enter}`)

/** Fragebogen mit einem Interesse ausfüllen, damit „Ideen finden“ frei ist. */
async function answerMinimal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Musik' }))
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('Fragebogen', () => {
  it('sperrt „Ideen finden“, bis Interessen, Frust oder Lernziel angegeben sind', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, { settings: aiSettings, aiProvider: new MockAiProvider() })

    expect(screen.getByRole('heading', { level: 1, name: 'Ich habe keine Idee' })).toBeVisible()
    expect(findsIdeasButton()).toBeDisabled()
    expect(
      screen.getByText(
        'Gib Interessen, ein Ärgernis aus dem Alltag oder ein Lernziel an, dann geht es los.',
      ),
    ).toBeVisible()

    await answerMinimal(user)
    expect(findsIdeasButton()).toBeEnabled()
  })

  it('zählt den Fortschritt mit „x von 6 Fragen beantwortet“', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, { settings: aiSettings, aiProvider: new MockAiProvider() })

    // Die Plattform steht von Anfang an auf „Egal“ und zählt damit als beantwortet.
    await answerMinimal(user)
    expect(screen.getByText('2 von 6 Fragen beantwortet')).toBeVisible()

    await user.type(screen.getByLabelText('Was nervt dich im Alltag?'), FRUSTRATION)
    expect(screen.getByText('3 von 6 Fragen beantwortet')).toBeVisible()

    await user.click(screen.getByRole('radio', { name: 'Ein paar Stunden' }))
    expect(screen.getByText('4 von 6 Fragen beantwortet')).toBeVisible()
  })

  it('schaltet Zeit und Plattform allein nicht frei', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, { settings: aiSettings, aiProvider: new MockAiProvider() })

    await user.click(screen.getByRole('radio', { name: 'Ein paar Stunden' }))
    await user.click(screen.getByRole('radio', { name: 'Web' }))

    expect(findsIdeasButton()).toBeDisabled()
    expect(screen.getByText(/Gib Interessen, ein Ärgernis/)).toBeVisible()
  })

  it('schaltet Vorschlags-Chips um (aria-pressed) und wählt sie wieder ab', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, { settings: aiSettings, aiProvider: new MockAiProvider() })

    const music = screen.getByRole('button', { name: 'Musik' })
    expect(music).toHaveAttribute('aria-pressed', 'false')
    await user.click(music)
    expect(music).toHaveAttribute('aria-pressed', 'true')
    await user.click(music)
    expect(music).toHaveAttribute('aria-pressed', 'false')
  })

  it('übernimmt eigene Schlagwörter per Enter und per Komma und entfernt sie mit dem X-Knopf', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, { settings: aiSettings, aiProvider: new MockAiProvider() })

    await addInterests(user, 'Astronomie')
    expect(screen.getByRole('button', { name: 'Astronomie entfernen' })).toBeVisible()

    await user.type(screen.getByLabelText('Was interessiert dich? hinzufügen'), 'Garten,')
    expect(screen.getByRole('button', { name: 'Garten entfernen' })).toBeVisible()
    expect(screen.getByLabelText('Was interessiert dich? hinzufügen')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Astronomie entfernen' }))
    expect(screen.queryByRole('button', { name: 'Astronomie entfernen' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Garten entfernen' })).toBeVisible()
  })

  it('lässt Doppelte entfallen, auch wenn sie sich nur in Groß- und Kleinschreibung unterscheiden', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, { settings: aiSettings, aiProvider: new MockAiProvider() })

    const music = screen.getByRole('button', { name: 'Musik' })
    await user.click(music)
    await addInterests(user, 'musik')
    await addInterests(user, 'Astronomie')
    await addInterests(user, 'ASTRONOMIE')

    expect(music).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /^musik entfernen$/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Astronomie entfernen' })).toHaveLength(1)
  })

  it('zeigt bei „Antworten ändern“ den Fragebogen mit den Antworten', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, {
      settings: aiSettings,
      aiProvider: new MockAiProvider([ideasAnswer('Alpha')]),
    })

    await answerMinimal(user)
    await user.type(screen.getByLabelText('Was nervt dich im Alltag?'), FRUSTRATION)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })

    await user.click(screen.getByRole('button', { name: 'Antworten ändern' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Erzähl kurz von dir' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Musik' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Was nervt dich im Alltag?')).toHaveValue(FRUSTRATION)

    await user.click(screen.getByRole('button', { name: 'Zurück zu den Ideen' }))
    expect(card('Alpha')).toBeVisible()
  })
})

describe('Ideen', () => {
  it('zeigt Ideenkarten mit Aufwand, Neuheit und Lernwert und fragt die KI genau einmal', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      JSON.stringify({
        ideas: [
          candidate('Alpha', { effort: 'medium', novelty: 4, learningValue: 5 }),
          candidate('Beta'),
        ],
      }),
    ])
    renderRoute(ROUTE, { settings: aiSettings, aiProvider })

    await user.type(screen.getByLabelText('Was nervt dich im Alltag?'), FRUSTRATION)
    await user.click(findsIdeasButton())

    const alpha = await screen.findByRole('article', { name: 'Alpha' })
    expect(card('Beta')).toBeVisible()
    expect(within(alpha).getByText('Aufwand: mittel')).toBeVisible()
    expect(within(alpha).getByText('Neuheit 4/5')).toBeVisible()
    expect(within(alpha).getByText('Lernwert 5/5')).toBeVisible()
    expect(aiProvider.requests).toHaveLength(1)
  })

  it('schickt die Antworten des Fragebogens in den Prompt', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([ideasAnswer('Alpha')])
    renderRoute(ROUTE, { settings: aiSettings, aiProvider })

    await addInterests(user, 'Musik')
    await user.type(screen.getByLabelText('Was nervt dich im Alltag?'), FRUSTRATION)
    await user.type(screen.getByLabelText('Was möchtest du dabei lernen?'), LEARNING_GOAL)
    await user.click(screen.getByRole('radio', { name: 'Ein paar Abende' }))
    await user.click(screen.getByRole('radio', { name: 'Web' }))
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })

    const prompt = lastMessage(aiProvider.requests[0])
    expect(prompt).toContain('Interessen: Musik')
    expect(prompt).toContain(FRUSTRATION)
    expect(prompt).toContain(LEARNING_GOAL)
    expect(prompt).toContain('ein paar Abende')
    expect(prompt).toContain('Web-App im Browser')
  })

  it('„Neu würfeln“ ersetzt die Ideen und nennt die alten Titel als bereits gezeigt', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      ideasAnswer('Alpha', 'Beta'),
      ideasAnswer('Gamma', 'Delta'),
    ])
    renderRoute(ROUTE, { settings: aiSettings, aiProvider })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })

    await user.click(screen.getByRole('button', { name: 'Neu würfeln' }))
    await screen.findByRole('article', { name: 'Gamma' })

    expect(cardTitles()).toEqual(['Gamma', 'Delta'])
    expect(aiProvider.requests).toHaveLength(2)
    const second = lastMessage(aiProvider.requests[1])
    expect(second).toContain('# Bereits gezeigte Ideen (nicht wiederholen)')
    expect(second).toContain('- Alpha')
    expect(second).toContain('- Beta')
  })

  it('„Einfacher“ ersetzt die Idee an derselben Stelle', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      ideasAnswer('Alpha', 'Beta', 'Gamma'),
      ideasAnswer('Beta einfach'),
    ])
    renderRoute(ROUTE, { settings: aiSettings, aiProvider })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Beta' })

    await user.click(within(card('Beta')).getByRole('button', { name: 'Einfacher' }))
    await screen.findByRole('article', { name: 'Beta einfach' })

    expect(cardTitles()).toEqual(['Alpha', 'Beta einfach', 'Gamma'])
    expect(lastMessage(aiProvider.requests[1])).toContain('deutlich einfacher')
  })

  it('„Mehr wie diese“ behält das Vorbild vorn und hängt die neuen Ideen dahinter', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      ideasAnswer('Alpha', 'Beta', 'Gamma', 'Delta'),
      ideasAnswer('Ähnlich 1', 'Ähnlich 2', 'Ähnlich 3', 'Ähnlich 4'),
    ])
    renderRoute(ROUTE, { settings: aiSettings, aiProvider })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })

    await user.click(within(card('Alpha')).getByRole('button', { name: 'Mehr wie diese' }))
    await screen.findByRole('article', { name: 'Ähnlich 4' })

    expect(cardTitles()).toEqual(['Alpha', 'Ähnlich 1', 'Ähnlich 2', 'Ähnlich 3', 'Ähnlich 4'])
    const prompt = lastMessage(aiProvider.requests[1])
    expect(prompt).toContain('# Vorbild')
    expect(prompt).toContain('Titel: Alpha')
  })

  it('wandelt eine Idee nach eigenem Wunsch ab und schickt den Wunsch mit', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      ideasAnswer('Alpha', 'Beta'),
      ideasAnswer('Alpha teilbar'),
    ])
    renderRoute(ROUTE, { settings: aiSettings, aiProvider })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })

    const alpha = card('Alpha')
    await user.type(
      within(alpha).getByRole('textbox', { name: 'Eigener Wunsch für diese Idee' }),
      'mit Freunden teilen',
    )
    await user.click(within(alpha).getByRole('button', { name: 'Abwandeln' }))
    await screen.findByRole('article', { name: 'Alpha teilbar' })

    expect(cardTitles()).toEqual(['Alpha teilbar', 'Beta'])
    expect(lastMessage(aiProvider.requests[1])).toContain('Wunsch der Person: mit Freunden teilen')
  })

  it('kombiniert zwei ausgewählte Karten zu einer neuen Idee vorn und leert die Auswahl', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      ideasAnswer('Alpha', 'Beta', 'Gamma', 'Delta'),
      ideasAnswer('Alpha und Beta vereint'),
    ])
    renderRoute(ROUTE, { settings: aiSettings, aiProvider })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })

    await user.click(within(card('Alpha')).getByRole('checkbox'))
    await user.click(within(card('Beta')).getByRole('checkbox'))
    expect(screen.getByText('Alpha + Beta')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Ausgewählte kombinieren' }))

    await screen.findByRole('article', { name: 'Alpha und Beta vereint' })
    expect(cardTitles()).toEqual(['Alpha und Beta vereint', 'Alpha', 'Beta', 'Gamma', 'Delta'])
    expect(
      screen.queryByRole('button', { name: 'Ausgewählte kombinieren' }),
    ).not.toBeInTheDocument()
    expect(within(card('Alpha')).getByRole('checkbox')).not.toBeChecked()

    const prompt = lastMessage(aiProvider.requests[1])
    expect(prompt).toContain('Verbinde diese beiden Ideen')
    expect(prompt).toContain('Titel: Alpha')
    expect(prompt).toContain('Titel: Beta')
  })

  it('zeigt bei nur einer ausgewählten Karte den Hinweis und sperrt „Ausgewählte kombinieren“', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, {
      settings: aiSettings,
      aiProvider: new MockAiProvider([ideasAnswer('Alpha', 'Beta')]),
    })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })

    await user.click(within(card('Alpha')).getByRole('checkbox'))
    expect(screen.getByText('Wähle noch eine zweite Idee zum Kombinieren.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Ausgewählte kombinieren' })).toBeDisabled()
  })

  it('„Diese Idee nehmen“ legt ein Projekt an, öffnet es und räumt den Stand auf', async () => {
    const user = userEvent.setup()
    const { repository, router } = renderRoute(ROUTE, {
      settings: aiSettings,
      aiProvider: new MockAiProvider([ideasAnswer('Alpha')]),
    })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })
    expect(sessionStorage.getItem(IDEATION_STORAGE_KEY)).not.toBeNull()

    await user.click(within(card('Alpha')).getByRole('button', { name: 'Diese Idee nehmen' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeVisible()
    expect(router.state.location.pathname).toMatch(/^\/projekte\/[\w-]+$/)
    expect(sessionStorage.getItem(IDEATION_STORAGE_KEY)).toBeNull()

    const [summary] = await repository.list()
    expect(summary?.name).toBe('Alpha')
    const project = await repository.get(summary!.id)
    expect(project?.entryPoint).toBe('noIdea')
    const sections = project!.blueprint.sections
    expect(sections.problem).toMatchObject({ source: 'aiAccepted' })
    expect(sections.problem.content).toContain('Alpha hilft im Alltag.')
    expect(sections.audience).toMatchObject({ content: 'Studierende', source: 'aiAccepted' })
    expect(sections.features.content).toContain('Erste Funktion')
    expect(sections.features).toMatchObject({ source: 'aiAccepted' })
    expect(sections.techStack).toMatchObject({
      content: 'Web-App im Browser',
      source: 'aiAccepted',
    })
  })

  it('meldet, wenn das Projekt nicht angelegt werden kann, und bleibt bei den Ideen', async () => {
    const user = userEvent.setup()
    const repository = new MemoryProjectRepository()
    renderRoute(ROUTE, {
      repository,
      settings: aiSettings,
      aiProvider: new MockAiProvider([ideasAnswer('Alpha')]),
    })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })
    vi.spyOn(repository, 'save').mockRejectedValueOnce(new Error('Speicher voll'))
    await user.click(within(card('Alpha')).getByRole('button', { name: 'Diese Idee nehmen' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/nicht/i)
    expect(card('Alpha')).toBeVisible()
    await user.click(within(alert).getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(sessionStorage.getItem(IDEATION_STORAGE_KEY)).not.toBeNull()
  })

  it('zeigt bei Fehlern die Meldung mit „Erneut versuchen“, der zweite Versuch klappt', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      new AiError('network', 'Netzwerk weg'),
      ideasAnswer('Alpha'),
    ])
    renderRoute(ROUTE, { settings: aiSettings, aiProvider })

    await answerMinimal(user)
    await user.click(findsIdeasButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Keine Verbindung zu OpenRouter. Prüfe deine Internetverbindung.',
    )
    await user.click(within(alert).getByRole('button', { name: 'Erneut versuchen' }))

    expect(await screen.findByRole('article', { name: 'Alpha' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(aiProvider.requests).toHaveLength(2)
  })

  it('blendet die Fehlermeldung mit „Schließen“ aus', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, {
      settings: aiSettings,
      aiProvider: new MockAiProvider([new AiError('network', 'Netzwerk weg')]),
    })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    const alert = await screen.findByRole('alert')

    await user.click(within(alert).getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(findsIdeasButton()).toBeEnabled()
  })

  it('meldet „keine neue Idee“, wenn die KI nur unbrauchbare Ideen liefert', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      JSON.stringify({ ideas: [candidate('Alpha', { pitch: '   ' })] }),
    ])
    renderRoute(ROUTE, { settings: aiSettings, aiProvider })

    await answerMinimal(user)
    await user.click(findsIdeasButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die KI hat keine neue Idee geliefert.',
    )
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('meldet „keine neue Idee“ beim Neu würfeln mit einem bekannten Titel', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, {
      settings: aiSettings,
      aiProvider: new MockAiProvider([ideasAnswer('Alpha'), ideasAnswer('alpha')]),
    })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })

    await user.click(screen.getByRole('button', { name: 'Neu würfeln' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die KI hat keine neue Idee geliefert.',
    )
    expect(cardTitles()).toEqual(['Alpha'])
  })

  it('bricht eine laufende Anfrage ab und kehrt in den Ausgangszustand zurück', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTE, { settings: aiSettings, aiProvider: new PendingProvider() })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    const status = await screen.findByRole('status')
    expect(within(status).getByText('Die KI sucht Ideen, die zu dir passen …')).toBeVisible()

    await user.click(within(status).getByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(findsIdeasButton()).toBeEnabled()
  })

  it('stellt die Ideen nach dem Neuladen aus dem sessionStorage wieder her', async () => {
    const user = userEvent.setup()
    const { unmount } = renderRoute(ROUTE, {
      settings: aiSettings,
      aiProvider: new MockAiProvider([ideasAnswer('Alpha', 'Beta')]),
    })

    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: 'Alpha' })
    unmount()

    renderRoute(ROUTE, { settings: aiSettings, aiProvider: new MockAiProvider() })

    expect(await screen.findByRole('article', { name: 'Alpha' })).toBeVisible()
    expect(cardTitles()).toEqual(['Alpha', 'Beta'])
  })
})

describe('Ohne KI-Key', () => {
  it('zeigt den Hinweis, sperrt „Ideen finden“ und startet mit „Ohne KI starten“ ein Projekt', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider()
    const { repository, router } = renderRoute(ROUTE, { aiProvider })

    expect(
      screen.getByText('Für die KI-Funktionen brauchst du einen OpenRouter-API-Key.'),
    ).toBeVisible()
    await addInterests(user, 'Musik')
    await user.type(screen.getByLabelText('Was nervt dich im Alltag?'), FRUSTRATION)
    expect(findsIdeasButton()).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Ohne KI starten' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/projekte\//))
    const [summary] = await repository.list()
    const project = await repository.get(summary!.id)
    expect(project?.entryPoint).toBe('noIdea')
    expect(project?.blueprint.sections.problem).toMatchObject({ source: 'user' })
    expect(project?.blueprint.sections.problem.content).toContain(FRUSTRATION)
    expect(project?.blueprint.sections.problem.content).toContain('Musik')
    expect(aiProvider.requests).toEqual([])
  })
})

describe('Ideen als Einträge', () => {
  async function showIdeas(...titles: string[]) {
    const user = userEvent.setup()
    const rendered = renderRoute(ROUTE, {
      settings: aiSettings,
      aiProvider: new MockAiProvider([ideasAnswer(...titles)]),
    })
    await answerMinimal(user)
    await user.click(findsIdeasButton())
    await screen.findByRole('article', { name: titles[0] })
    return { user, ...rendered }
  }

  it('legt jede Idee mit Steckbrief im Papierkorb an', async () => {
    const { repository } = await showIdeas('Alpha', 'Beta')

    const trashed = await repository.list({ status: 'trashed' })
    expect(trashed.map((entry) => entry.name).sort()).toEqual(['Alpha', 'Beta'])
    expect(await repository.list({ status: 'saved' })).toEqual([])
    const alpha = await repository.get(trashed.find((entry) => entry.name === 'Alpha')!.id)
    expect(alpha).toMatchObject({
      entryPoint: 'noIdea',
      profile: {
        pitch: 'Alpha hilft im Alltag.',
        audience: 'Studierende',
        monetization: { model: '', priceRange: '', reason: '' },
        risks: [],
      },
    })
    expect(
      screen.getByText('Jede Idee liegt im Papierkorb, bis du sie speicherst oder wählst.'),
    ).toBeVisible()
  })

  it('speichert eine Idee in der Bibliothek, ohne sie zu wählen', async () => {
    const { user, repository, router } = await showIdeas('Alpha')

    const save = await within(card('Alpha')).findByRole('button', {
      name: 'Alpha in der Bibliothek speichern',
    })
    await user.click(save)

    await waitFor(() => expect(save).toHaveTextContent('Gespeichert'))
    expect(save).toBeDisabled()
    const [saved] = await repository.list({ status: 'saved' })
    expect(saved?.name).toBe('Alpha')
    expect(router.state.location.pathname).toBe(ROUTE)
  })

  it('„Diese Idee nehmen“ speichert genau den Eintrag der Idee', async () => {
    const { user, repository, router } = await showIdeas('Alpha', 'Beta')
    const [before] = (await repository.list({ status: 'trashed' })).filter(
      (entry) => entry.name === 'Alpha',
    )

    await user.click(within(card('Alpha')).getByRole('button', { name: 'Diese Idee nehmen' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeVisible()
    expect(router.state.location.pathname).toBe(`/projekte/${before!.id}`)
    const saved = await repository.list({ status: 'saved' })
    expect(saved.map((entry) => entry.id)).toEqual([before!.id])
    expect((await repository.list({ status: 'trashed' })).map((entry) => entry.name)).toEqual([
      'Beta',
    ])
  })
})
