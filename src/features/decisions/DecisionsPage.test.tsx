import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiError, MockAiProvider } from '@/core/ai'
import { decisionsResultSchema } from '@/core/ai/prompts'
import type { Project } from '@/core/blueprint'
import { updateSection } from '@/core/blueprint'
import { applyDecisionCandidates } from '@/core/engine'
import { MemoryProjectRepository } from '@/core/storage'
import { renderRoute } from '@/test/render'

const WEB_TITLE = 'Web-App oder native App?'
const AUDIENCE_TITLE = 'Für wen ist die App?'

const DECISIONS = {
  decisions: [
    {
      sectionId: 'audience',
      title: AUDIENCE_TITLE,
      context: 'Die Zielgruppe bestimmt den Umfang.',
      leverage: 2,
      options: [
        {
          label: 'Studierende',
          pros: ['Klarer Fokus'],
          cons: ['Kleiner Markt'],
          consequence: 'Kleiner Umfang.',
        },
        { label: 'Freelancer', pros: [], cons: [], consequence: 'Mehr Funktionen nötig.' },
      ],
      recommendedOption: null,
    },
    {
      sectionId: 'techStack',
      title: WEB_TITLE,
      context: 'Die Plattform bestimmt die Technik.',
      leverage: 5,
      options: [
        {
          label: 'Web-App',
          pros: ['Läuft überall'],
          cons: ['Kein Zugriff aufs Gerät'],
          consequence: 'Ein Code für alle.',
        },
        {
          label: 'Native App',
          pros: ['Voller Gerätezugriff'],
          cons: ['Zwei Plattformen'],
          consequence: 'Mehr Aufwand.',
        },
      ],
      recommendedOption: 0,
    },
  ],
}

const ADDITIONS = {
  additions: [
    { sectionId: 'features', text: 'Export als PDF', reason: 'Angebote müssen druckbar sein.' },
    {
      sectionId: 'risks',
      text: 'Datenverlust bei Absturz',
      reason: 'Ungespeicherte Arbeit geht verloren.',
    },
  ],
}

const card = (title: string) => screen.getByRole('article', { name: title })

/** Legt ein Projekt im Speicher an und wendet optional eine Änderung darauf an. */
async function seedProject(change: (project: Project) => Project = (project) => project) {
  const repository = new MemoryProjectRepository()
  const created = await repository.create('Alpha')
  await repository.save(change(created))
  return { repository, id: created.id }
}

/** Legt ein Projekt mit offenen Entscheidungen an (ohne KI). */
const seedDecisions = () =>
  seedProject((project) =>
    applyDecisionCandidates(project, decisionsResultSchema.parse(DECISIONS), { now: new Date() }),
  )

const openDecisions = (
  repository: MemoryProjectRepository,
  id: string,
  aiProvider?: MockAiProvider,
  withKey = true,
) =>
  renderRoute(`/projekte/${id}/entscheidungen`, {
    repository,
    settings: withKey ? { apiKey: 'x' } : undefined,
    aiProvider: aiProvider ?? new MockAiProvider(),
  })

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

/** Wählt auf der Web-App-Karte „Native App“, schreibt eine Begründung und entscheidet. */
async function decideNative(user: ReturnType<typeof userEvent.setup>) {
  const web = await screen.findByRole('article', { name: WEB_TITLE })
  await user.click(within(web).getByRole('radio', { name: 'Native App' }))
  await user.type(
    within(web).getByRole('textbox', { name: 'Begründung (optional)' }),
    'Gerätezugriff ist wichtig.',
  )
  await user.click(within(web).getByRole('button', { name: 'Entscheiden' }))
  await waitFor(() =>
    expect(screen.queryByRole('article', { name: WEB_TITLE })).not.toBeInTheDocument(),
  )
}

const logSection = () =>
  screen.getByRole('heading', { level: 2, name: 'Entscheidungsprotokoll' }).closest('section')

describe('Entscheidungsseite', () => {
  it('ermittelt Entscheidungen und zeigt die Grundsatzfrage mit Empfehlung zuerst', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    const aiProvider = new MockAiProvider([JSON.stringify(DECISIONS)])
    openDecisions(repository, id, aiProvider)

    await user.click(await screen.findByRole('button', { name: 'Entscheidungen finden' }))

    const articles = await screen.findAllByRole('article')
    const headings = articles.map(
      (article) => within(article).getByRole('heading', { level: 3 }).textContent,
    )
    expect(headings).toEqual([WEB_TITLE, AUDIENCE_TITLE])
    expect(within(card(WEB_TITLE)).getByText('Grundsatz')).toBeVisible()
    expect(within(card(AUDIENCE_TITLE)).getByText('Detail')).toBeVisible()
    expect(within(card(WEB_TITLE)).getByText('Empfohlen')).toBeVisible()
    expect(within(card(AUDIENCE_TITLE)).queryByText('Empfohlen')).not.toBeInTheDocument()
    expect(within(card(WEB_TITLE)).getByText('Folge: Ein Code für alle.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Neu ermitteln' })).toBeEnabled()
    expect(aiProvider.requests).toHaveLength(1)
  })

  it('wählt keine Empfehlung vor, entscheidet mit Begründung und speichert das Protokoll', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedDecisions()
    openDecisions(repository, id)

    const web = await screen.findByRole('article', { name: WEB_TITLE })
    expect(within(web).getByRole('radio', { name: /Web-App/ })).not.toBeChecked()
    expect(within(web).getByRole('button', { name: 'Entscheiden' })).toBeDisabled()

    await decideNative(user)

    const log = logSection() as HTMLElement
    expect(within(log).getByRole('heading', { level: 3, name: WEB_TITLE })).toBeVisible()
    expect(within(log).getByText('Native App')).toHaveClass('font-bold')
    expect(within(log).getByText('Gerätezugriff ist wichtig.')).toBeVisible()

    await expectStored(repository, id, (project) => {
      const decision = project.decisions.find((d) => d.title === WEB_TITLE)
      const nativeId = decision?.options.find((o) => o.label === 'Native App')?.id
      expect(decision?.status).toBe('decided')
      expect(decision?.chosenOptionId).toBe(nativeId)
      expect(decision?.rationale).toBe('Gerätezugriff ist wichtig.')
      expect(decision?.decidedAt).not.toBeNull()
    })
  })

  it('öffnet eine getroffene Entscheidung wieder und behält die Begründung als Entwurf', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedDecisions()
    openDecisions(repository, id)

    await decideNative(user)
    const log = logSection() as HTMLElement
    await user.click(within(log).getByRole('button', { name: 'Wieder öffnen' }))

    const web = await screen.findByRole('article', { name: WEB_TITLE })
    expect(within(web).getByRole('textbox', { name: 'Begründung (optional)' })).toHaveValue(
      'Gerätezugriff ist wichtig.',
    )
    expect(within(web).getByRole('button', { name: 'Entscheiden' })).toBeDisabled()
    expect(
      within(logSection() as HTMLElement).getByText(
        'Hier erscheinen die Entscheidungen, die du getroffen hast.',
      ),
    ).toBeVisible()

    await expectStored(repository, id, (project) => {
      const decision = project.decisions.find((d) => d.title === WEB_TITLE)
      expect(decision?.status).toBe('open')
      expect(decision?.chosenOptionId).toBeNull()
      expect(decision?.decidedAt).toBeNull()
    })
  })

  it('verwirft eine offene Entscheidung', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedDecisions()
    openDecisions(repository, id)

    const audience = await screen.findByRole('article', { name: AUDIENCE_TITLE })
    await user.click(within(audience).getByRole('button', { name: 'Verwerfen' }))

    await waitFor(() =>
      expect(screen.queryByRole('article', { name: AUDIENCE_TITLE })).not.toBeInTheDocument(),
    )
    await expectStored(repository, id, (project) => {
      expect(project.decisions.find((d) => d.title === AUDIENCE_TITLE)?.status).toBe('dismissed')
    })
  })

  it('zeigt Widersprüche aus Regeln mit Fundstellen und KI-Widersprüche getrennt', async () => {
    const { repository, id } = await seedProject((project) => {
      const withRules = updateSection(project, 'techStack', {
        content: 'Offline-first mit lokaler Datenbank.',
      })
      const withFeatures = updateSection(withRules, 'features', {
        content: 'Echtzeit-Zusammenarbeit für Teams',
      })
      return {
        ...withFeatures,
        interview: {
          ...withFeatures.interview,
          analysis: {
            summary: 'Zusammenfassung',
            gaps: [],
            contradictions: [
              { sectionIds: ['problem'], text: 'Das Problem passt nicht zur Zielgruppe.' },
            ],
            analyzedAt: new Date().toISOString(),
            promptVersion: 1,
          },
        },
      }
    })
    openDecisions(repository, id)

    const warnings = await screen.findByRole('heading', {
      level: 2,
      name: 'Widersprüche im Blueprint',
    })
    const box = warnings.closest('section') as HTMLElement
    expect(
      within(box).getByText(
        'Offline-first und Echtzeit-Zusammenarbeit vertragen sich schlecht – Echtzeit braucht eine Verbindung.',
      ),
    ).toBeVisible()
    expect(within(box).getByText('„Offline-first mit lokaler Datenbank.“')).toBeVisible()
    expect(within(box).getByText('„Echtzeit-Zusammenarbeit für Teams“')).toBeVisible()
    expect(within(box).getByText('Aus der letzten Analyse')).toBeVisible()
    expect(within(box).getByText('Das Problem passt nicht zur Zielgruppe.')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('holt Vorschläge, nimmt einen an und lehnt einen ab', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    const aiProvider = new MockAiProvider([JSON.stringify(ADDITIONS)])
    openDecisions(repository, id, aiProvider)

    await user.click(await screen.findByRole('button', { name: 'Vorschläge holen' }))

    const exportItem = (await screen.findByText('Export als PDF')).closest('li') as HTMLElement
    expect(screen.getByRole('heading', { level: 3, name: 'Kernfunktionen (MVP)' })).toBeVisible()
    await user.click(within(exportItem).getByRole('button', { name: 'Annehmen' }))

    const riskItem = screen.getByText('Datenverlust bei Absturz').closest('li') as HTMLElement
    await user.click(within(riskItem).getByRole('button', { name: 'Ablehnen' }))

    await waitFor(() =>
      expect(screen.queryByText('Datenverlust bei Absturz')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Angenommen: 1 · Abgelehnt: 1')).toBeVisible()
    await expectStored(repository, id, (project) => {
      expect(project.blueprint.sections.features.content).toBe('- Export als PDF')
      expect(project.blueprint.sections.features.source).toBe('aiAccepted')
      expect(project.blueprint.sections.risks.content).toBe('')
      expect(project.additions.map((a) => a.status).sort()).toEqual(['accepted', 'rejected'])
    })
  })

  it('zeigt bei einem KI-Fehler die Meldung mit technischen Details', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedDecisions()
    openDecisions(
      repository,
      id,
      new MockAiProvider([new AiError('rateLimited', 'Too many requests', { status: 429 })]),
    )

    await user.click(await screen.findByRole('button', { name: 'Neu ermitteln' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Es wurden gerade zu viele Anfragen gesendet')
    expect(alert).toHaveTextContent('Technische Details (HTTP 429): Too many requests')
    expect(screen.getByRole('button', { name: 'Neu ermitteln' })).toBeEnabled()
    expect(card(WEB_TITLE)).toBeVisible()
  })

  it('bricht eine laufende Ermittlung ab', async () => {
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
    openDecisions(repository, id, aiProvider)

    await user.click(await screen.findByRole('button', { name: 'Entscheidungen finden' }))
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Entscheidungen werden ermittelt …')

    await user.click(within(status).getByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entscheidungen finden' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('zeigt ohne Key einen Hinweis und deaktiviert die KI-Buttons', async () => {
    const { repository, id } = await seedProject()
    openDecisions(repository, id, undefined, false)

    expect(
      await screen.findByText('Für die KI-Funktionen brauchst du einen OpenRouter-API-Key.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Entscheidungen finden' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Vorschläge holen' })).toBeDisabled()
    expect(screen.getByText(/Noch keine Entscheidungen ermittelt/)).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Entscheidungsprotokoll' })).toBeVisible()
    expect(
      screen.getByText(
        'Gerade keine offenen Vorschläge. Hol dir neue, wenn sich dein Blueprint geändert hat.',
      ),
    ).toBeVisible()
  })

  it('zeigt einen Hinweis, wenn es das Projekt nicht gibt', async () => {
    renderRoute('/projekte/gibt-es-nicht/entscheidungen')

    expect(await screen.findByRole('heading', { name: 'Projekt nicht gefunden' })).toBeVisible()
  })
})
