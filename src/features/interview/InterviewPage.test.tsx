import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiError, MockAiProvider } from '@/core/ai'
import { blueprintAnalysisResultSchema } from '@/core/ai/prompts'
import type { Project } from '@/core/blueprint'
import { applyAnalysis } from '@/core/engine'
import { MemoryProjectRepository } from '@/core/storage'
import { renderRoute } from '@/test/render'

const ANALYSIS = {
  summary: 'Die Idee ist grob, das Problem fehlt noch.',
  gaps: [{ sectionIds: ['problem'], text: 'Das Problem ist nicht beschrieben.' }],
  contradictions: [],
  questions: [
    {
      key: 'q1',
      sectionId: 'audience',
      text: 'Für wen ist die App?',
      why: 'Die Zielgruppe bestimmt alles Weitere.',
      leverage: 2,
      options: ['Studierende', 'Freelancer'],
      dependsOn: [],
    },
    {
      key: 'q2',
      sectionId: 'problem',
      text: 'Welches Problem löst die App?',
      why: 'Ohne Problem fehlt der Ausgangspunkt.',
      leverage: 5,
      options: ['Zeitverlust', 'Kosten'],
      dependsOn: [],
    },
  ],
}

const ANALYSIS_JSON = JSON.stringify(ANALYSIS)

const INTEGRATION_JSON = JSON.stringify({
  sections: [
    {
      id: 'problem',
      content: 'Die App spart Zeit bei der Angebotserstellung.',
      maturity: 'vague',
    },
  ],
})

const PROBLEM_QUESTION = 'Welches Problem löst die App?'
const AUDIENCE_QUESTION = 'Für wen ist die App?'
const PROBLEM = 'Problem & Vision'

const questionCard = (text: string) => screen.getByRole('article', { name: text })
const proposalCard = (section: string) => screen.getByRole('article', { name: section })

/** Legt ein Projekt im Speicher an, optional mit den Fragen aus `ANALYSIS`. */
async function seedProject({ withQuestions = false } = {}) {
  const repository = new MemoryProjectRepository()
  const created = await repository.create('Alpha')
  const project: Project = withQuestions
    ? applyAnalysis(created, blueprintAnalysisResultSchema.parse(ANALYSIS), { now: new Date() })
    : created
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
  aiProvider?: MockAiProvider,
) =>
  renderRoute(`/projekte/${id}/fragen`, {
    repository,
    settings: { apiKey: 'x' },
    aiProvider: aiProvider ?? new MockAiProvider(),
  })

describe('Fragenseite', () => {
  it('analysiert den Blueprint, zeigt die Grundsatzfrage zuerst und übernimmt eine Antwort', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    openInterview(repository, id, new MockAiProvider([ANALYSIS_JSON, INTEGRATION_JSON]))

    await user.click(await screen.findByRole('button', { name: 'Blueprint analysieren' }))

    expect(await screen.findByText('Die Idee ist grob, das Problem fehlt noch.')).toBeVisible()
    const headings = screen
      .getAllByRole('article')
      .map((article) => within(article).getByRole('heading', { level: 3 }).textContent)
    expect(headings).toEqual([PROBLEM_QUESTION, AUDIENCE_QUESTION])
    expect(within(questionCard(PROBLEM_QUESTION)).getByText('Grundsatzfrage')).toBeVisible()
    expect(within(questionCard(AUDIENCE_QUESTION)).getByText('Detail')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Neu analysieren' })).toBeEnabled()

    const problem = questionCard(PROBLEM_QUESTION)
    await user.click(within(problem).getByRole('radio', { name: 'Zeitverlust' }))
    await user.click(screen.getByRole('button', { name: 'Antworten speichern' }))

    const proposal = await screen.findByRole('heading', {
      level: 2,
      name: 'Vorschläge zu deinen Antworten',
    })
    expect(proposal).toBeVisible()
    const card = proposalCard(PROBLEM)
    expect(within(card).getByText('(leer)')).toBeVisible()
    expect(within(card).getByText('Die App spart Zeit bei der Angebotserstellung.')).toBeVisible()
    await user.click(within(card).getByRole('button', { name: 'Übernehmen' }))

    // Nach dem Übernehmen steht die nächste offene Frage in der Runde.
    expect(await screen.findByRole('heading', { level: 3, name: AUDIENCE_QUESTION })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Vorschläge zu deinen Antworten' }),
    ).not.toBeInTheDocument()

    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem.content).toBe(
        'Die App spart Zeit bei der Angebotserstellung.',
      )
      expect(project.blueprint.sections.problem.source).toBe('aiAccepted')
      expect(project.interview.log).toHaveLength(1)
      expect(project.interview.log[0]).toMatchObject({
        questionText: PROBLEM_QUESTION,
        action: 'answered',
        answerText: 'Zeitverlust',
      })
    })

    expect(screen.getByText('Verlauf (1)')).toBeVisible()
    expect(screen.getByText('Zeitverlust')).toBeInTheDocument()
  })

  it('stellt eine Frage mit „Später“ zurück und protokolliert es im Verlauf', async () => {
    const user = userEvent.setup()
    const aiProvider = new MockAiProvider()
    const { repository, id } = await seedProject({ withQuestions: true })
    openInterview(repository, id, aiProvider)

    const problem = await screen.findByRole('article', { name: PROBLEM_QUESTION })
    await user.click(within(problem).getByRole('button', { name: 'Später' }))
    expect(within(problem).getByRole('button', { name: 'Später' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'Antworten speichern' }))

    await waitFor(() =>
      expect(screen.queryByRole('article', { name: PROBLEM_QUESTION })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('article', { name: AUDIENCE_QUESTION })).toBeVisible()
    expect(aiProvider.requests).toHaveLength(0)

    const history = screen.getByText('Verlauf (1)').closest('details')
    expect(history).not.toBeNull()
    expect(within(history as HTMLElement).getByText(PROBLEM_QUESTION)).toBeInTheDocument()
    expect(within(history as HTMLElement).getByText('Später')).toBeInTheDocument()

    await expectStored(repository, id, (project) => {
      const question = project.interview.questions.find((q) => q.text === PROBLEM_QUESTION)
      expect(question?.status).toBe('deferred')
      expect(project.interview.log[0]?.action).toBe('deferred')
    })
  })

  it('verwirft Freitext und Optionswahl gegenseitig und speichert ohne KI direkt im Abschnitt', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject({ withQuestions: true })
    const aiProvider = new MockAiProvider()
    renderRoute(`/projekte/${id}/fragen`, { repository, aiProvider })

    const problem = await screen.findByRole('article', { name: PROBLEM_QUESTION })
    expect(await screen.findByText(/Für die KI-Funktionen brauchst du/)).toBeVisible()
    const analyze = screen.getByRole('button', { name: 'Neu analysieren' })
    expect(analyze).toBeDisabled()

    await user.click(within(problem).getByRole('radio', { name: 'Zeitverlust' }))
    await user.type(
      within(problem).getByRole('textbox', { name: 'Oder eigene Antwort' }),
      'Eigener Text',
    )
    expect(within(problem).getByRole('radio', { name: 'Zeitverlust' })).not.toBeChecked()

    await user.click(within(problem).getByRole('radio', { name: 'Kosten' }))
    expect(within(problem).getByRole('textbox', { name: 'Oder eigene Antwort' })).toHaveValue('')
    await user.click(within(problem).getByRole('radio', { name: 'Zeitverlust' }))
    await user.type(
      within(problem).getByRole('textbox', { name: 'Ergänzung (optional)' }),
      'Vor allem Angebote',
    )
    await user.click(screen.getByRole('button', { name: 'Antworten speichern' }))

    await waitFor(() =>
      expect(screen.queryByRole('article', { name: PROBLEM_QUESTION })).not.toBeInTheDocument(),
    )
    expect(aiProvider.requests).toHaveLength(0)
    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem.content).toBe(
        '- Welches Problem löst die App? Zeitverlust – Vor allem Angebote',
      )
      expect(project.blueprint.sections.problem.source).toBe('user')
    })
  })

  it('zeigt bei einem Analysefehler die Meldung mit technischen Details', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    openInterview(
      repository,
      id,
      new MockAiProvider([new AiError('rateLimited', 'Too many requests', { status: 429 })]),
    )

    await user.click(await screen.findByRole('button', { name: 'Blueprint analysieren' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Es wurden gerade zu viele Anfragen gesendet')
    expect(alert).toHaveTextContent('Technische Details (HTTP 429): Too many requests')
    expect(screen.getByRole('button', { name: 'Blueprint analysieren' })).toBeEnabled()
  })

  it('bricht eine laufende Analyse ab', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    const aiProvider = new MockAiProvider()
    vi.spyOn(aiProvider, 'complete').mockImplementation(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new AiError('aborted', 'Anfrage abgebrochen')),
          )
        }),
    )
    openInterview(repository, id, aiProvider)

    await user.click(await screen.findByRole('button', { name: 'Blueprint analysieren' }))
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Blueprint wird analysiert …')

    await user.click(within(status).getByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Blueprint analysieren' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hängt die Antworten wörtlich an, wenn das Einarbeiten fehlschlägt', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    openInterview(
      repository,
      id,
      new MockAiProvider([ANALYSIS_JSON, new AiError('timeout', 'Zeitüberschreitung')]),
    )

    await user.click(await screen.findByRole('button', { name: 'Blueprint analysieren' }))
    await user.click(
      within(await screen.findByRole('article', { name: PROBLEM_QUESTION })).getByRole('radio', {
        name: 'Zeitverlust',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Antworten speichern' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Deine Antworten sind gespeichert')
    expect(alert).toHaveTextContent('Die KI hat zu lange gebraucht')
    expect(alert).toHaveTextContent('Technische Details: Zeitüberschreitung')

    await user.click(screen.getByRole('button', { name: 'Antworten wörtlich anhängen' }))

    expect(await screen.findByRole('article', { name: AUDIENCE_QUESTION })).toBeVisible()
    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.problem.content).toBe(
        '- Welches Problem löst die App? Zeitverlust',
      )
      expect(project.interview.questions.find((q) => q.text === PROBLEM_QUESTION)?.status).toBe(
        'answered',
      )
    })
  })

  it('zeigt bei leerer Runde einen Hinweis statt Fragen', async () => {
    const { repository, id } = await seedProject()
    openInterview(repository, id)

    expect(
      await screen.findByText(
        'Gerade keine offenen Fragen. Analysiere den Blueprint, um neue zu bekommen.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Antworten speichern' })).not.toBeInTheDocument()
    expect(screen.getByText('Verlauf (0)')).toBeVisible()
  })

  it('zeigt einen Hinweis, wenn es das Projekt nicht gibt', async () => {
    renderRoute('/projekte/gibt-es-nicht/fragen')

    expect(await screen.findByRole('heading', { name: 'Projekt nicht gefunden' })).toBeVisible()
  })
})
