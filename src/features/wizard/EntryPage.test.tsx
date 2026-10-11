import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiError, MockAiProvider, type CompletionRequest } from '@/core/ai'
import { MAX_IDEA_TEXT_LENGTH } from '@/core/engine'
import { VALID_TEST_KEY } from '@/test/msw/openrouter'
import { renderRoute } from '@/test/render'

const AI_ANSWER = JSON.stringify({
  projectName: 'Familien-Organizer',
  summary: 'Eine App, die Familien den Alltag organisiert.',
  sections: [
    { id: 'problem', content: 'Familien verlieren den Überblick über Termine.', maturity: 'vague' },
    { id: 'audience', content: 'Eltern mit Schulkindern.', maturity: 'decided' },
  ],
})

const aiSettings = { apiKey: VALID_TEST_KEY }

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

const textarea = (name: string) => screen.getByLabelText(name)
const submitAi = () => screen.getByRole('button', { name: 'Idee einordnen' })
const submitManual = () => screen.getByRole('button', { name: 'Ohne KI starten' })

describe('Einstieg „Teil-Idee“', () => {
  it('zeigt Überschrift, Eingabefeld und Zähler', async () => {
    const user = userEvent.setup()
    renderRoute('/neu/teil-idee', { settings: aiSettings })

    expect(screen.getByRole('heading', { level: 1, name: 'Ich habe eine Teil-Idee' })).toBeVisible()
    expect(textarea('Beschreib deine Idee')).toBeVisible()
    expect(screen.getByText('0 / 20.000')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Datei laden' })).not.toBeInTheDocument()

    await user.type(textarea('Beschreib deine Idee'), 'Hallo')
    expect(screen.getByText('5 / 20.000')).toBeVisible()
  })

  it('zeigt einen Fehler und sperrt „Idee einordnen“ bei zu langem Text', () => {
    renderRoute('/neu/teil-idee', { settings: aiSettings })

    fireEvent.change(textarea('Beschreib deine Idee'), {
      target: { value: 'x'.repeat(MAX_IDEA_TEXT_LENGTH + 1) },
    })

    expect(screen.getByText('20.001 / 20.000')).toHaveClass('text-destructive')
    expect(
      screen.getByText('Der Text ist zu lang. Kürze ihn auf höchstens 20.000 Zeichen.'),
    ).toBeVisible()
    expect(textarea('Beschreib deine Idee')).toHaveAttribute('aria-invalid', 'true')
    expect(submitAi()).toBeDisabled()
  })

  it('ordnet den Text mit KI ein, legt ein Projekt an und öffnet es', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([AI_ANSWER])
    const { router, repository } = renderRoute('/neu/teil-idee', {
      settings: aiSettings,
      aiProvider,
    })

    await user.type(textarea('Beschreib deine Idee'), 'Eine App für Familientermine')
    await user.click(submitAi())

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Familien-Organizer' }),
    ).toBeVisible()
    const [summary] = await repository.list()
    expect(router.state.location.pathname).toBe(`/projekte/${summary?.id}`)
    const project = await repository.get(summary!.id)
    expect(project?.entryPoint).toBe('partialIdea')
    expect(project?.blueprint.sections.problem).toMatchObject({
      content: 'Familien verlieren den Überblick über Termine.',
      maturity: 'vague',
      source: 'aiSuggestion',
    })
    expect(project?.blueprint.sections.audience).toMatchObject({
      content: 'Eltern mit Schulkindern.',
      maturity: 'decided',
      source: 'aiSuggestion',
    })
    expect(project?.blueprint.sections.features.content).toBe('')

    const [request] = aiProvider.requests
    expect(request?.messages.at(-1)?.content).toContain('Eine App für Familientermine')
    expect(request?.messages[0]?.content).toContain('Die Person hat eine Teil-Idee')
  })

  it('übernimmt den vorgeschlagenen Namen nur, wenn kein Name eingegeben wurde', async () => {
    const user = userEvent.setup()
    const { repository } = renderRoute('/neu/teil-idee', {
      settings: aiSettings,
      aiProvider: new MockAiProvider([AI_ANSWER]),
    })

    await user.type(textarea('Beschreib deine Idee'), 'Text')
    await user.click(submitAi())
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Familien-Organizer' }),
    ).toBeVisible()
    expect((await repository.list())[0]?.name).toBe('Familien-Organizer')
  })

  it('behält einen eingegebenen Projektnamen', async () => {
    const user = userEvent.setup()
    const { repository } = renderRoute('/neu/teil-idee', {
      settings: aiSettings,
      aiProvider: new MockAiProvider([AI_ANSWER]),
    })

    await user.type(screen.getByLabelText('Projektname (optional)'), 'Mein Name')
    await user.type(textarea('Beschreib deine Idee'), 'Text')
    await user.click(submitAi())

    expect(await screen.findByRole('heading', { level: 1, name: 'Mein Name' })).toBeVisible()
    const [summary] = await repository.list()
    expect((await repository.get(summary!.id))?.blueprint.sections.problem.content).toBe(
      'Familien verlieren den Überblick über Termine.',
    )
  })

  it('zeigt bei KI-Fehlern die Meldung, legt kein Projekt an und behält den Text', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      new AiError('insufficientCredits', 'Guthaben aufgebraucht', { status: 402 }),
    ])
    const { repository } = renderRoute('/neu/teil-idee', { settings: aiSettings, aiProvider })

    await user.type(textarea('Beschreib deine Idee'), 'Meine Idee')
    await user.click(submitAi())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dein OpenRouter-Guthaben reicht nicht aus. Lade es auf und versuch es dann erneut.',
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Technische Details (HTTP 402): Guthaben aufgebraucht',
    )
    expect(await repository.list()).toEqual([])
    expect(textarea('Beschreib deine Idee')).toHaveValue('Meine Idee')
    expect(submitAi()).toBeEnabled()
  })

  it('bricht eine laufende Anfrage ab und kehrt ohne Fehlermeldung in den Ausgangszustand zurück', async () => {
    const user = userEvent.setup()
    const { repository } = renderRoute('/neu/teil-idee', {
      settings: aiSettings,
      aiProvider: new PendingProvider(),
    })

    await user.type(textarea('Beschreib deine Idee'), 'Meine Idee')
    await user.click(submitAi())
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(submitAi()).toBeEnabled()
    expect(textarea('Beschreib deine Idee')).toHaveValue('Meine Idee')
    expect(await repository.list()).toEqual([])
  })

  it('startet ohne KI und übernimmt den Text in „Problem & Vision“', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider()
    const { router, repository } = renderRoute('/neu/teil-idee', { aiProvider })

    expect(
      screen.getByText('Für die KI-Funktionen brauchst du einen OpenRouter-API-Key.'),
    ).toBeVisible()
    expect(submitAi()).toBeDisabled()

    await user.type(textarea('Beschreib deine Idee'), 'Eine Idee ohne KI')
    await user.click(submitManual())

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/projekte\//))
    const [summary] = await repository.list()
    expect(summary?.name).toBe('Neues Projekt')
    const project = await repository.get(summary!.id)
    expect(project?.entryPoint).toBe('partialIdea')
    expect(project?.blueprint.sections.problem).toMatchObject({
      content: 'Eine Idee ohne KI',
      source: 'user',
    })
    expect(aiProvider.requests).toEqual([])
  })

  it('übernimmt einen eingegebenen Namen beim Start ohne KI', async () => {
    const user = userEvent.setup()
    const { repository } = renderRoute('/neu/teil-idee')

    await user.type(screen.getByLabelText('Projektname (optional)'), 'Ohne KI Projekt')
    await user.click(submitManual())

    await waitFor(async () => expect(await repository.list()).toHaveLength(1))
    expect((await repository.list())[0]?.name).toBe('Ohne KI Projekt')
  })
})

describe('Einstieg „Fast fertig“', () => {
  it('lädt eine Textdatei in das Eingabefeld', async () => {
    const user = userEvent.setup()
    renderRoute('/neu/fast-fertig', { settings: aiSettings })

    expect(screen.getByRole('heading', { level: 1, name: 'Ich habe fast alles' })).toBeVisible()
    const file = new File(['# Mein Konzept\n\nDetails'], 'konzept.md', { type: 'text/markdown' })
    await user.upload(screen.getByLabelText('Textdatei auswählen'), file)

    expect(textarea('Füge dein Konzept ein')).toHaveValue('# Mein Konzept\n\nDetails')
    expect(screen.getByText('23 / 20.000')).toBeVisible()
  })

  it('lehnt andere Dateitypen ab', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderRoute('/neu/fast-fertig', { settings: aiSettings })

    const image = new File(['binär'], 'bild.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Textdatei auswählen'), image)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Bitte wähle eine Datei mit der Endung .txt oder .md.',
    )
    expect(textarea('Füge dein Konzept ein')).toHaveValue('')
  })

  it('verwendet den Einstieg für die Einordnung', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([AI_ANSWER])
    const { router } = renderRoute('/neu/fast-fertig', { settings: aiSettings, aiProvider })

    await user.type(textarea('Füge dein Konzept ein'), 'Komplettes Konzept')
    await user.click(submitAi())

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/projekte\//))
    expect(aiProvider.requests[0]?.messages[0]?.content).toContain(
      'Die Person hat ein fast fertiges Konzept',
    )
  })
})

describe('Einstieg „Keine Idee“', () => {
  it('zeigt den Fragebogen der Ideensuche statt des Eingabeformulars', () => {
    renderRoute('/neu/keine-idee', { settings: aiSettings })

    expect(screen.getByRole('heading', { level: 1, name: 'Ich habe keine Idee' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Erzähl kurz von dir' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Ideen finden' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Idee einordnen' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Beschreib deine Idee')).not.toBeInTheDocument()
  })
})

describe('Unbekannte Einstiege', () => {
  it('zeigt bei unbekanntem Slug die 404-Seite', () => {
    renderRoute('/neu/gibt-es-nicht')

    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    expect(screen.queryByLabelText('Beschreib deine Idee')).not.toBeInTheDocument()
  })
})
