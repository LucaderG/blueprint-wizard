import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiError, MockAiProvider } from '@/core/ai'
import { blueprintAnalysisResultSchema } from '@/core/ai/prompts'
import type { Project, SectionId } from '@/core/blueprint'
import { updateSection } from '@/core/blueprint/editing'
import { applyAnalysis } from '@/core/engine'
import { MemoryProjectRepository } from '@/core/storage'
import { renderRoute } from '@/test/render'

const PROBLEM_QUESTION = 'Welches Problem löst die App?'
const PLATFORM_QUESTION = 'Auf welcher Plattform soll sie laufen?'
const AUDIENCE_QUESTION = 'Für wen ist die App?'
const NEXT_QUESTION = 'Welche Funktion kommt zuerst?'
const PROBLEM = 'Problem & Vision'
const TECH = 'Tech-Stack & Plattform'
const PROBLEM_TEXT = 'Die App spart Zeit bei der Angebotserstellung.'
const PROBLEM_OLD = 'Angebote dauern zu lange.'
const PROBLEM_LONG =
  'Angebote werden von Hand in Word geschrieben und kosten jede Woche viele Stunden.'

/** Antwort der Analyse: Grundsatzfragen Problem und Plattform, Detailfrage Zielgruppe. */
const ANALYSIS = {
  summary: 'Die Idee ist grob, das Problem fehlt noch.',
  gaps: [{ sectionIds: ['problem'], text: 'Das Problem ist nicht beschrieben.' }],
  contradictions: [],
  questions: [
    {
      key: 'q1',
      sectionId: 'audience',
      text: AUDIENCE_QUESTION,
      why: 'Die Zielgruppe bestimmt alles Weitere.',
      leverage: 2,
      options: ['Studierende', 'Freelancer'],
      dependsOn: [],
    },
    {
      key: 'q2',
      sectionId: 'problem',
      text: PROBLEM_QUESTION,
      why: 'Ohne Problem fehlt der Ausgangspunkt.',
      leverage: 5,
      options: ['Zeitverlust', 'Kosten'],
      dependsOn: [],
    },
    {
      key: 'q3',
      sectionId: 'techStack',
      text: PLATFORM_QUESTION,
      why: 'Die Plattform bestimmt die Technik.',
      leverage: 4,
      options: [],
      dependsOn: [],
    },
  ],
}

/** Nächste Runde nach dem Einarbeiten: eine neue Frage. */
const ANALYSIS_NEXT = {
  summary: 'Neue Runde nach den Antworten.',
  gaps: [],
  contradictions: [],
  questions: [
    {
      key: 'n1',
      sectionId: 'features',
      text: NEXT_QUESTION,
      why: 'Die Reihenfolge bestimmt den MVP.',
      leverage: 4,
      options: [],
      dependsOn: [],
    },
  ],
}

const integrationOf = (sections: { id: SectionId; content: string; maturity: string }[]) =>
  JSON.stringify({ sections })

const INTEGRATION_PROBLEM = integrationOf([
  { id: 'problem', content: PROBLEM_TEXT, maturity: 'vague' },
])

const INTEGRATION_MULTI = integrationOf([
  { id: 'problem', content: PROBLEM_TEXT, maturity: 'vague' },
  { id: 'techStack', content: 'Web-Anwendung im Browser, keine native App.', maturity: 'decided' },
])

/** Stark kürzende Änderung: landet unter „Bitte prüfen“. */
const INTEGRATION_SHRINK = integrationOf([
  { id: 'problem', content: 'Zeit sparen.', maturity: 'decided' },
])

const questionCard = (text: string) => screen.getByRole('article', { name: text })
const questionHeadings = () =>
  screen
    .getAllByRole('article')
    .map((article) => within(article).getByRole('heading', { level: 3 }).textContent)
const submitButton = () => screen.getByRole('button', { name: 'Antworten übernehmen' })
/** Das Statusfeld mit dem Abbrechen-Knopf (die Fortschrittszeile der Runde meldet auch „läuft“). */
const findStatusWithButton = (name: string) =>
  waitFor(() => {
    const status = screen
      .getAllByRole('status')
      .find((el) => within(el).queryByRole('button', { name }))
    if (!status) throw new Error(`Kein Status mit Knopf „${name}“`)
    return within(status).getByRole('button', { name })
  })
const reviewSection = () =>
  screen.getByRole('heading', { name: 'Bitte prüfen' }).closest('section') as HTMLElement

/** Legt ein Projekt im Speicher an, optional mit einer Analyse und vorhandenem Abschnittstext. */
async function seedProject({
  analysis,
  sections = {},
  withoutAnalysis = false,
  deferAll = false,
}: {
  /** Analyse, die schon im Projekt steht (ohne sie startet beim Besuch eine Analyse). */
  analysis?: unknown
  /** Vorhandener Text in Abschnitten (Reife „vage“, Quelle „user“). */
  sections?: Partial<Record<SectionId, string>>
  /** Entfernt die Analyse wieder, die Fragen bleiben. */
  withoutAnalysis?: boolean
  /** Stellt alle Fragen zurück („Später“). */
  deferAll?: boolean
} = {}) {
  const repository = new MemoryProjectRepository()
  const created = await repository.create('Alpha')
  let project: Project = analysis
    ? applyAnalysis(created, blueprintAnalysisResultSchema.parse(analysis), { now: new Date() })
    : created
  for (const [id, content] of Object.entries(sections) as [SectionId, string][]) {
    project = updateSection(project, id, { content, maturity: 'vague', source: 'user' })
  }
  if (withoutAnalysis || deferAll) {
    project = {
      ...project,
      interview: {
        ...project.interview,
        analysis: withoutAnalysis ? null : project.interview.analysis,
        questions: deferAll
          ? project.interview.questions.map((q) => ({ ...q, status: 'deferred' as const }))
          : project.interview.questions,
      },
    }
  }
  await repository.save(project)
  return { repository, id: created.id }
}

/** Wartet, bis das Repository den gewünschten Stand hat (Autosave läuft verzögert). */
async function expectStored(
  repository: MemoryProjectRepository,
  id: string,
  check: (project: Project) => void,
) {
  await waitFor(
    async () => {
      const stored = await repository.get(id)
      if (!stored) throw new Error('Projekt fehlt')
      check(stored)
    },
    { timeout: 3000 },
  )
}

const openInterview = (
  repository: MemoryProjectRepository,
  id: string,
  aiProvider = new MockAiProvider(),
) =>
  renderRoute(`/projekte/${id}/fragen`, {
    repository,
    settings: { apiKey: 'x' },
    aiProvider,
  })

/**
 * KI-Anbieter, der die ersten Anfragen wie `answers` beantwortet und danach nie antwortet
 * (bis der Abbruch kommt).
 */
function hangingAfter(answers: string[]) {
  const provider = new MockAiProvider(answers)
  const complete = provider.complete.bind(provider)
  vi.spyOn(provider, 'complete').mockImplementation((request) => {
    if (provider.requests.length < answers.length) return complete(request)
    return new Promise((_resolve, reject) => {
      request.signal?.addEventListener('abort', () =>
        reject(new AiError('aborted', 'Anfrage abgebrochen')),
      )
    })
  })
  return provider
}

describe('Fragenseite', () => {
  it('analysiert beim ersten Besuch automatisch und zeigt alle stellbaren Fragen, die Grundsatzfrage zuerst', async () => {
    const { repository, id } = await seedProject()
    const aiProvider = new MockAiProvider([JSON.stringify(ANALYSIS)])
    openInterview(repository, id, aiProvider)

    expect(await screen.findByText(ANALYSIS.summary)).toBeVisible()
    expect(aiProvider.requests).toHaveLength(1)
    expect(aiProvider.requests[0]?.jsonSchema?.name).toBe('blueprint_analysis')
    expect(questionHeadings()).toEqual([PROBLEM_QUESTION, PLATFORM_QUESTION, AUDIENCE_QUESTION])
    expect(within(questionCard(PROBLEM_QUESTION)).getByText('Grundsatzfrage')).toBeVisible()
    expect(within(questionCard(AUDIENCE_QUESTION)).getByText('Detail')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Offene Fragen (3)' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Neu analysieren' })).toBeEnabled()
    expect(submitButton()).toBeDisabled()
  })

  it('startet ohne API-Key keine Analyse', async () => {
    const { repository, id } = await seedProject()
    const aiProvider = new MockAiProvider([JSON.stringify(ANALYSIS)])
    renderRoute(`/projekte/${id}/fragen`, { repository, aiProvider })

    expect(await screen.findByText(/Für die KI-Funktionen brauchst du/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Blueprint analysieren' })).toBeDisabled()
    expect(aiProvider.requests).toHaveLength(0)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it.each([
    ['offenen', {}],
    ['zurückgestellten', { deferAll: true }],
  ])('startet keine Analyse, wenn schon %s Fragen vorliegen', async (_label, options) => {
    const { repository, id } = await seedProject({
      analysis: ANALYSIS,
      withoutAnalysis: true,
      ...options,
    })
    const aiProvider = new MockAiProvider([JSON.stringify(ANALYSIS)])
    openInterview(repository, id, aiProvider)

    expect(await screen.findByRole('article', { name: PROBLEM_QUESTION })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Blueprint analysieren' })).toBeEnabled()
    expect(aiProvider.requests).toHaveLength(0)
  })

  it('startet keine Analyse, wenn die letzte Analyse keine offenen Fragen ergab', async () => {
    const { repository, id } = await seedProject({
      analysis: { summary: 'Alles beantwortet.', gaps: [], contradictions: [], questions: [] },
    })
    const aiProvider = new MockAiProvider([JSON.stringify(ANALYSIS)])
    openInterview(repository, id, aiProvider)

    expect(await screen.findByText('Alles beantwortet.')).toBeVisible()
    expect(
      screen.getByText('Gerade keine offenen Fragen. Mit „Neu analysieren“ holst du neue.'),
    ).toBeVisible()
    expect(screen.getByText('Verlauf (0)')).toBeVisible()
    expect(aiProvider.requests).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Antworten übernehmen' })).not.toBeInTheDocument()
  })

  it('beantwortet mehrere Fragen und übernimmt sie mit einem Klick, danach wird neu analysiert', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      JSON.stringify(ANALYSIS),
      INTEGRATION_MULTI,
      JSON.stringify(ANALYSIS_NEXT),
    ])
    const { repository, id } = await seedProject()
    openInterview(repository, id, aiProvider)

    const problem = await screen.findByRole('article', { name: PROBLEM_QUESTION })
    const platform = questionCard(PLATFORM_QUESTION)
    const audience = questionCard(AUDIENCE_QUESTION)

    await user.click(within(problem).getByRole('radio', { name: 'Zeitverlust' }))
    await user.type(
      within(problem).getByRole('textbox', { name: 'Ergänzung' }),
      'Vor allem Angebote',
    )
    await user.type(
      within(platform).getByRole('textbox', { name: 'Deine Antwort' }),
      'Web-Anwendung im Browser',
    )
    await user.click(within(audience).getByRole('radio', { name: 'Freelancer' }))
    expect(screen.getByText('3 von 3 beantwortet, 0 später')).toBeVisible()

    await user.click(submitButton())

    expect(
      await screen.findByText(`Eingearbeitet in 2 Abschnitte: ${PROBLEM}, ${TECH}.`),
    ).toBeVisible()
    // Alle Antworten gehen in einer einzigen Einarbeitungs-Anfrage an die KI.
    const integration = aiProvider.requests[1]
    expect(integration?.jsonSchema?.name).toBe('answer_integration')
    const userMessage = integration?.messages.find((m) => m.role === 'user')?.content ?? ''
    expect(userMessage).toContain('Zeitverlust – Vor allem Angebote')
    expect(userMessage).toContain('Web-Anwendung im Browser')
    expect(userMessage).toContain('Freelancer')

    // Nach der letzten Frage holt die Seite selbst neue Fragen.
    expect(await screen.findByRole('heading', { level: 3, name: NEXT_QUESTION })).toBeVisible()
    expect(aiProvider.requests).toHaveLength(3)
    expect(aiProvider.requests[2]?.jsonSchema?.name).toBe('blueprint_analysis')
    expect(screen.queryByRole('article', { name: PROBLEM_QUESTION })).not.toBeInTheDocument()

    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem).toMatchObject({
        content: PROBLEM_TEXT,
        source: 'aiAccepted',
      })
      expect(project.blueprint.sections.techStack).toMatchObject({
        content: 'Web-Anwendung im Browser, keine native App.',
        source: 'aiAccepted',
      })
      expect(project.blueprint.sections.audience.content).toBe('')
      expect(project.interview.log.map((e) => [e.questionText, e.answerText])).toEqual([
        [PROBLEM_QUESTION, 'Zeitverlust – Vor allem Angebote'],
        [PLATFORM_QUESTION, 'Web-Anwendung im Browser'],
        [AUDIENCE_QUESTION, 'Freelancer'],
      ])
    })
    expect(screen.getByText('Verlauf (3)')).toBeVisible()
  })

  it('zeigt Vorher und Nachher und nimmt die Übernahme mit „Zurücknehmen“ zurück', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject({
      analysis: ANALYSIS,
      sections: { problem: PROBLEM_OLD },
    })
    openInterview(repository, id, new MockAiProvider([INTEGRATION_PROBLEM]))

    await user.click(
      within(await screen.findByRole('article', { name: PROBLEM_QUESTION })).getByRole('radio', {
        name: 'Zeitverlust',
      }),
    )
    await user.click(submitButton())
    expect(await screen.findByText(`Eingearbeitet in 1 Abschnitt: ${PROBLEM}.`)).toBeVisible()

    await user.click(screen.getByText('Änderungen ansehen'))
    const changes = screen.getByText('Änderungen ansehen').closest('details') as HTMLElement
    expect(within(changes).getByText('Vorher')).toBeVisible()
    expect(within(changes).getByText(PROBLEM_OLD)).toBeVisible()
    expect(within(changes).getByText('Nachher')).toBeVisible()
    expect(within(changes).getByText(PROBLEM_TEXT)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Zurücknehmen' }))

    await waitFor(() => expect(screen.queryByText(/^Eingearbeitet in/)).not.toBeInTheDocument())
    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem).toEqual({
        id: 'problem',
        content: PROBLEM_OLD,
        maturity: 'vague',
        source: 'user',
      })
    })
  })

  it('legt einen stark kürzenden Vorschlag unter „Bitte prüfen“ und übernimmt ihn erst mit „Übernehmen“', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject({
      analysis: ANALYSIS,
      sections: { problem: PROBLEM_LONG },
    })
    openInterview(repository, id, new MockAiProvider([INTEGRATION_SHRINK]))

    await user.click(
      within(await screen.findByRole('article', { name: PROBLEM_QUESTION })).getByRole('radio', {
        name: 'Zeitverlust',
      }),
    )
    await user.click(submitButton())

    const review = await screen.findByRole('heading', { name: 'Bitte prüfen' })
    expect(review).toBeVisible()
    expect(within(reviewSection()).getByText('Zeit sparen.')).toBeVisible()
    expect(screen.queryByText(/^Eingearbeitet in/)).not.toBeInTheDocument()
    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem.content).toBe(PROBLEM_LONG)
    })

    await user.click(within(reviewSection()).getByRole('button', { name: 'Übernehmen' }))

    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem).toMatchObject({
        content: 'Zeit sparen.',
        source: 'aiAccepted',
      })
    })
    expect(screen.queryByRole('heading', { name: 'Bitte prüfen' })).not.toBeInTheDocument()
  })

  it('verwirft einen stark kürzenden Vorschlag mit „Verwerfen“, ohne den Abschnitt zu ändern', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject({
      analysis: ANALYSIS,
      sections: { problem: PROBLEM_LONG },
    })
    openInterview(repository, id, new MockAiProvider([INTEGRATION_SHRINK]))

    await user.click(
      within(await screen.findByRole('article', { name: PROBLEM_QUESTION })).getByRole('radio', {
        name: 'Zeitverlust',
      }),
    )
    await user.click(submitButton())
    await screen.findByRole('heading', { name: 'Bitte prüfen' })
    await user.click(within(reviewSection()).getByRole('button', { name: 'Verwerfen' }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Bitte prüfen' })).not.toBeInTheDocument(),
    )
    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem).toMatchObject({
        content: PROBLEM_LONG,
        source: 'user',
      })
      expect(project.interview.log).toHaveLength(1)
    })
  })

  it('verschiebt eine Frage mit „Später“ und zeigt sie nicht mehr in der Runde', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider()
    const { repository, id } = await seedProject({ analysis: ANALYSIS })
    openInterview(repository, id, aiProvider)

    const problem = await screen.findByRole('article', { name: PROBLEM_QUESTION })
    const later = within(problem).getByRole('button', { name: 'Später' })
    await user.click(later)
    expect(later).toHaveAttribute('aria-pressed', 'true')
    expect(within(problem).queryByRole('radio', { name: 'Zeitverlust' })).not.toBeInTheDocument()

    // Ein zweiter Klick nimmt „Später“ zurück.
    await user.click(later)
    expect(later).toHaveAttribute('aria-pressed', 'false')
    expect(within(problem).getByRole('radio', { name: 'Zeitverlust' })).toBeVisible()

    await user.click(later)
    await user.click(submitButton())

    await waitFor(() =>
      expect(screen.queryByRole('article', { name: PROBLEM_QUESTION })).not.toBeInTheDocument(),
    )
    expect(questionCard(PLATFORM_QUESTION)).toBeVisible()
    expect(questionCard(AUDIENCE_QUESTION)).toBeVisible()
    // Nur Zurückstellen, keine Einarbeitung und keine neue Analyse.
    expect(aiProvider.requests).toHaveLength(0)

    const history = screen.getByText('Verlauf (1)').closest('details') as HTMLElement
    expect(within(history).getByText(PROBLEM_QUESTION)).toBeInTheDocument()
    expect(within(history).getByText('Später')).toBeInTheDocument()
    await expectStored(repository, id, (project) => {
      const question = project.interview.questions.find((q) => q.text === PROBLEM_QUESTION)
      expect(question?.status).toBe('deferred')
      expect(project.interview.log[0]?.action).toBe('deferred')
    })
  })

  it('holt neue Fragen, wenn alle offenen Fragen auf „Später“ stehen', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([JSON.stringify(ANALYSIS_NEXT)])
    // Mit beschriebenem Problem ist die neue Funktionsfrage sofort stellbar.
    const { repository, id } = await seedProject({
      analysis: ANALYSIS,
      sections: { problem: PROBLEM_OLD },
    })
    openInterview(repository, id, aiProvider)

    for (const text of [PROBLEM_QUESTION, PLATFORM_QUESTION, AUDIENCE_QUESTION]) {
      const card = await screen.findByRole('article', { name: text })
      await user.click(within(card).getByRole('button', { name: 'Später' }))
    }
    await user.click(submitButton())

    // Die zurückgestellten Fragen tauchen nicht sofort wieder auf, stattdessen läuft eine Analyse.
    expect(await screen.findByRole('article', { name: NEXT_QUESTION })).toBeVisible()
    expect(aiProvider.requests).toHaveLength(1)
    expect(screen.queryByRole('article', { name: PROBLEM_QUESTION })).not.toBeInTheDocument()
  })

  it('hebt eine Option beim erneuten Anklicken auf, Klick aufs Label wählt sie', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject({ analysis: ANALYSIS })
    openInterview(repository, id, new MockAiProvider())

    const problem = await screen.findByRole('article', { name: PROBLEM_QUESTION })
    await user.click(within(problem).getByText('Zeitverlust'))
    expect(within(problem).getByRole('radio', { name: 'Zeitverlust' })).toBeChecked()
    expect(submitButton()).toBeEnabled()

    await user.click(within(problem).getByRole('radio', { name: 'Zeitverlust' }))
    expect(within(problem).getByRole('radio', { name: 'Zeitverlust' })).not.toBeChecked()
    expect(submitButton()).toBeDisabled()
  })

  it('speichert ohne API-Key die Antworten direkt im Abschnitt, ohne KI', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider()
    const { repository, id } = await seedProject({ analysis: ANALYSIS })
    renderRoute(`/projekte/${id}/fragen`, { repository, aiProvider })

    const problem = await screen.findByRole('article', { name: PROBLEM_QUESTION })
    expect(await screen.findByText(/Für die KI-Funktionen brauchst du/)).toBeVisible()
    await user.click(within(problem).getByRole('radio', { name: 'Zeitverlust' }))
    await user.type(
      within(problem).getByRole('textbox', { name: 'Ergänzung' }),
      'Vor allem Angebote',
    )
    await user.click(submitButton())

    await waitFor(() =>
      expect(screen.queryByRole('article', { name: PROBLEM_QUESTION })).not.toBeInTheDocument(),
    )
    expect(aiProvider.requests).toHaveLength(0)
    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem).toMatchObject({
        content: '- Welches Problem löst die App? Zeitverlust – Vor allem Angebote',
        source: 'user',
      })
    })
  })

  it('übernimmt die Antworten mit Strg + Enter', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([INTEGRATION_PROBLEM])
    const { repository, id } = await seedProject({ analysis: ANALYSIS })
    openInterview(repository, id, aiProvider)

    const problem = await screen.findByRole('article', { name: PROBLEM_QUESTION })
    await user.click(within(problem).getByRole('radio', { name: 'Zeitverlust' }))
    await user.type(
      within(questionCard(PLATFORM_QUESTION)).getByRole('textbox', { name: 'Deine Antwort' }),
      'Web',
    )
    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(await screen.findByText(`Eingearbeitet in 1 Abschnitt: ${PROBLEM}.`)).toBeVisible()
    expect(aiProvider.requests).toHaveLength(1)
    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem.content).toBe(PROBLEM_TEXT)
    })
  })

  it('bietet nach einem Fehler beim Einarbeiten „Erneut versuchen“ an, das beim zweiten Mal klappt', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider([
      new AiError('timeout', 'Zeitüberschreitung'),
      INTEGRATION_PROBLEM,
    ])
    const { repository, id } = await seedProject({ analysis: ANALYSIS })
    openInterview(repository, id, aiProvider)

    await user.click(
      within(await screen.findByRole('article', { name: PROBLEM_QUESTION })).getByRole('radio', {
        name: 'Zeitverlust',
      }),
    )
    await user.click(submitButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Deine Antworten sind gespeichert')
    expect(alert).toHaveTextContent('Die KI hat zu lange gebraucht')
    expect(alert).toHaveTextContent('Technische Details: Zeitüberschreitung')
    await expectStored(repository, id, (project) => {
      expect(project.interview.questions.find((q) => q.text === PROBLEM_QUESTION)?.status).toBe(
        'answered',
      )
    })

    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(await screen.findByText(`Eingearbeitet in 1 Abschnitt: ${PROBLEM}.`)).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(aiProvider.requests).toHaveLength(2)
    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem.content).toBe(PROBLEM_TEXT)
    })
  })

  it('hängt die Antworten wörtlich an, wenn das Einarbeiten fehlschlägt und die KI nicht hilft', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject({ analysis: ANALYSIS })
    openInterview(
      repository,
      id,
      new MockAiProvider([new AiError('timeout', 'Zeitüberschreitung')]),
    )

    await user.click(
      within(await screen.findByRole('article', { name: PROBLEM_QUESTION })).getByRole('radio', {
        name: 'Zeitverlust',
      }),
    )
    await user.click(submitButton())
    expect(await screen.findByRole('alert')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Antworten wörtlich anhängen' }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem).toMatchObject({
        content: '- Welches Problem löst die App? Zeitverlust',
        source: 'user',
      })
      expect(project.interview.questions.find((q) => q.text === PROBLEM_QUESTION)?.status).toBe(
        'answered',
      )
    })
  })

  it('lässt sich beim Einarbeiten abbrechen', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject({ analysis: ANALYSIS })
    openInterview(repository, id, hangingAfter([]))

    await user.click(
      within(await screen.findByRole('article', { name: PROBLEM_QUESTION })).getByRole('radio', {
        name: 'Zeitverlust',
      }),
    )
    await user.click(submitButton())

    await user.click(await findStatusWithButton('Abbrechen'))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Die Anfrage wurde abgebrochen.')
    expect(within(alert).getByRole('button', { name: 'Erneut versuchen' })).toBeVisible()
    expect(screen.queryByText('Antworten werden eingearbeitet …')).not.toBeInTheDocument()
  })

  it('zeigt bei einem Analysefehler die Meldung mit technischen Details und analysiert nicht erneut', async () => {
    const { repository, id } = await seedProject()
    const aiProvider = new MockAiProvider([
      new AiError('rateLimited', 'Too many requests', { status: 429 }),
    ])
    openInterview(repository, id, aiProvider)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Es wurden gerade zu viele Anfragen gesendet')
    expect(alert).toHaveTextContent('Technische Details (HTTP 429): Too many requests')
    expect(screen.getByRole('button', { name: 'Blueprint analysieren' })).toBeEnabled()
    expect(aiProvider.requests).toHaveLength(1)
  })

  it('bricht eine laufende Analyse ab', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    const aiProvider = hangingAfter([])
    openInterview(repository, id, aiProvider)

    await user.click(await findStatusWithButton('Abbrechen'))

    await waitFor(() =>
      expect(screen.queryByText('Blueprint wird analysiert …')).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Blueprint analysieren' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(aiProvider.complete).toHaveBeenCalledTimes(1)
  })

  it('zeigt einen Hinweis, wenn es das Projekt nicht gibt', async () => {
    renderRoute('/projekte/gibt-es-nicht/fragen')

    expect(await screen.findByRole('heading', { name: 'Projekt nicht gefunden' })).toBeVisible()
  })
})
