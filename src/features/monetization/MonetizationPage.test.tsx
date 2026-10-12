import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiError, MockAiProvider, type CompletionRequest, type CompletionResult } from '@/core/ai'
import { monetizationModelsResultSchema } from '@/core/ai/prompts'
import type { Project } from '@/core/blueprint'
import { updateSection } from '@/core/blueprint'
import { applyModelCandidates, chooseModels } from '@/core/engine'
import { MemoryProjectRepository } from '@/core/storage'
import { renderRoute } from '@/test/render'

const scores = (value: number) => ({
  revenuePotential: value,
  implementationEase: value,
  userAcceptance: value,
  predictability: value,
  audienceFit: value,
  techFit: value,
})

const model = (kind: string, title: string, recommended = false) => ({
  kind,
  title,
  summary: `${title}: so sähe es aus.`,
  fitReason: 'Passt zur Zielgruppe.',
  concerns: ['Ein Haken'],
  scores: scores(kind === 'none' ? 1 : 4),
  recommended,
})

const MODELS = {
  models: [
    model('freemium', 'Kostenlos für kleine Teams', true),
    model('subscription', 'Team-Abo'),
    model('ads', 'Werbung im Dashboard'),
    model('license', 'Firmenlizenz'),
    model('none', 'Als Hobby betreiben'),
  ],
}

const PRICING = {
  strategies: [
    {
      strategy: 'tiers',
      title: 'Free, Pro, Team',
      summary: 'Drei Pakete.',
      examplePrices: 'Pro: 4–8 € pro Monat',
      reason: 'Leicht verständlich.',
      recommended: true,
    },
    {
      strategy: 'perSeat',
      title: 'Pro Person',
      summary: 'Preis je Teammitglied.',
      examplePrices: '3–6 € pro Person und Monat',
      reason: 'Wächst mit dem Team.',
      recommended: false,
    },
  ],
}

/** Hält die nächste Antwort zurück, bis der Test `release()` aufruft. */
class GatedAiProvider extends MockAiProvider {
  private open = () => {}
  private readonly gate = new Promise<void>((resolve) => (this.open = resolve))
  release() {
    this.open()
  }
  override async complete(request: CompletionRequest): Promise<CompletionResult> {
    await this.gate
    return super.complete(request)
  }
}

/** Legt ein Projekt im Speicher an; ohne Änderung ist der Blueprint leer. */
async function seedProject(change: (project: Project) => Project = (project) => project) {
  const repository = new MemoryProjectRepository()
  const created = await repository.create('Teamplaner')
  await repository.save(change(created))
  return { repository, id: created.id }
}

/** Blueprint, der die Freischaltung erfüllt. */
const ready = (project: Project) =>
  (['problem', 'audience', 'features', 'flows', 'techStack'] as const).reduce(
    (p, id) => updateSection(p, id, { content: `Inhalt ${id}`, maturity: 'decided' }),
    project,
  )

const withModels = (project: Project) =>
  applyModelCandidates(ready(project), monetizationModelsResultSchema.parse(MODELS))

const open = (
  repository: MemoryProjectRepository,
  id: string,
  aiProvider = new MockAiProvider(),
  withKey = true,
) =>
  renderRoute(`/projekte/${id}/monetarisierung`, {
    repository,
    settings: withKey ? { apiKey: 'x' } : undefined,
    aiProvider,
  })

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

describe('Monetarisierungsseite', () => {
  it('erklärt bei unfertigem Blueprint, was fehlt, und startet trotzdem', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    open(repository, id)

    expect(
      await screen.findByRole('heading', { name: 'Dein Blueprint ist noch nicht weit genug' }),
    ).toBeVisible()
    expect(screen.getByText('Vollständigkeit 0 % (empfohlen ab 60 %)')).toBeVisible()
    expect(
      screen.getByText('Inhalt in: Problem & Vision, Zielgruppe & Nutzer, Kernfunktionen (MVP)'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Modelle vorschlagen' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trotzdem starten' }))

    expect(screen.getByRole('button', { name: 'Modelle vorschlagen' })).toBeEnabled()
  })

  it('schlägt Modelle vor, vergleicht sie und übernimmt eine Kombination mit Hinweis', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject(ready)
    const aiProvider = new MockAiProvider([JSON.stringify(MODELS)])
    open(repository, id, aiProvider)

    await user.click(await screen.findByRole('button', { name: 'Modelle vorschlagen' }))

    const table = await screen.findByRole('table', { name: /Vergleich/ })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual([
      'Kriterium',
      'Kostenlos für kleine Teams',
      'Team-Abo',
      'Werbung im Dashboard',
      'Firmenlizenz',
      'Als Hobby betreiben',
    ])
    expect(within(table).getAllByRole('img', { name: '4 von 5 Punkten' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Empfohlen')).toBeVisible()

    const apply = screen.getByRole('button', { name: 'Auswahl übernehmen' })
    expect(apply).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /Werbung im Dashboard/ }))
    await user.click(screen.getByRole('checkbox', { name: /Firmenlizenz/ }))
    expect(screen.getByText(/Werbung passt selten zu Firmenlizenzen/)).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: /Kostenlos für kleine Teams/ }))
    expect(screen.getByRole('checkbox', { name: /Team-Abo/ })).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: 'Begründung (optional)' }), 'Mischung')
    await user.click(apply)

    expect(await screen.findByText('Auswahl gespeichert.')).toBeVisible()
    expect(screen.getByRole('heading', { name: '2. Preisstrategie' })).toBeVisible()
    await expectStored(repository, id, (project) => {
      expect(project.monetization?.chosenModelIds).toHaveLength(3)
      expect(project.monetization?.modelRationale).toBe('Mischung')
    })
  })

  it('sperrt „nicht monetarisieren“ in Kombination und schließt allein ohne Preisstrategie ab', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject(withModels)
    open(repository, id)

    await user.click(await screen.findByRole('checkbox', { name: /Als Hobby betreiben/ }))
    await user.click(screen.getByRole('checkbox', { name: /Team-Abo/ }))
    expect(screen.getByText(/lässt sich nicht mit anderen Modellen kombinieren/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Auswahl übernehmen' })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /Team-Abo/ }))
    await user.click(screen.getByRole('button', { name: 'Auswahl übernehmen' }))

    expect(screen.queryByRole('heading', { name: '2. Preisstrategie' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Monetarisierung abschließen' }))
    expect(await screen.findByText(/Abgeschlossen am/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Auswirkungen auf deinen Blueprint' })).toBeNull()
    await expectStored(repository, id, (project) =>
      expect(project.monetization?.status).toBe('decided'),
    )

    await user.click(screen.getByRole('button', { name: 'Wieder öffnen' }))
    expect(screen.getByRole('button', { name: 'Monetarisierung abschließen' })).toBeEnabled()
  })

  it('wählt eine Preisstrategie, schließt ab und übernimmt eine Auswirkung', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject(withModels)
    const aiProvider = new MockAiProvider([JSON.stringify(PRICING)])
    open(repository, id, aiProvider)

    await user.click(await screen.findByRole('checkbox', { name: /Team-Abo/ }))
    await user.click(screen.getByRole('button', { name: 'Auswahl übernehmen' }))
    expect(screen.getByText('Wähle noch eine Preisstrategie, um abzuschließen.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Monetarisierung abschließen' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Preisstrategien vorschlagen' }))
    expect(await screen.findByText('Pro: 4–8 € pro Monat')).toBeVisible()
    expect(screen.getAllByText('Beispielpreise (Annahme):')).toHaveLength(2)
    expect(aiProvider.requests[0]?.messages[1]?.content).toContain('- subscription – Team-Abo')

    await user.click(screen.getByRole('checkbox', { name: /Free, Pro, Team/ }))
    await user.click(screen.getByRole('button', { name: 'Preisstrategie übernehmen' }))
    await user.click(screen.getByRole('button', { name: 'Monetarisierung abschließen' }))

    const applyPayments = screen.getByRole('button', {
      name: 'In „Integrationen & externe Dienste“ übernehmen: Zahlungsanbieter anbinden (z. B. Stripe oder Paddle)',
    })
    await user.click(applyPayments)
    expect(applyPayments).not.toBeInTheDocument()
    expect(screen.getByText('Übernommen')).toBeVisible()

    await expectStored(repository, id, (project) => {
      expect(project.monetization).toMatchObject({
        status: 'decided',
        chosenPricingIds: [expect.any(String)],
      })
      expect(project.blueprint.sections.integrations.content).toBe(
        '- Zahlungsanbieter anbinden (z. B. Stripe oder Paddle)',
      )
    })

    // Rückgängig nimmt den übernommenen Hinweis wieder heraus.
    await user.click(screen.getByRole('button', { name: 'Rückgängig' }))
    expect(screen.getByRole('button', { name: /Zahlungsanbieter anbinden/ })).toBeVisible()
  })

  it('verwirft die Preisstrategien, wenn sich die Modellauswahl ändert', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject(withModels)
    open(repository, id, new MockAiProvider([JSON.stringify(PRICING)]))

    await user.click(await screen.findByRole('checkbox', { name: /Team-Abo/ }))
    await user.click(screen.getByRole('button', { name: 'Auswahl übernehmen' }))
    await user.click(screen.getByRole('button', { name: 'Preisstrategien vorschlagen' }))
    expect(await screen.findByText('Free, Pro, Team')).toBeVisible()

    await user.click(screen.getByRole('checkbox', { name: /Kostenlos für kleine Teams/ }))
    await user.click(screen.getByRole('button', { name: 'Auswahl übernehmen' }))

    expect(screen.queryByText('Free, Pro, Team')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preisstrategien vorschlagen' })).toBeVisible()
  })

  it('vergisst angehakte Modelle, die ein neuer Vorschlag ersetzt hat', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject(withModels)
    const rerun = { models: [model('oneTime', 'Einmalkauf'), model('usageBased', 'Nach Nutzung')] }
    open(repository, id, new MockAiProvider([JSON.stringify(rerun)]))

    for (const name of [/Team-Abo/, /Werbung im Dashboard/, /Firmenlizenz/]) {
      await user.click(await screen.findByRole('checkbox', { name }))
    }
    expect(screen.getByRole('checkbox', { name: /Kostenlos für kleine Teams/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Neu vorschlagen' }))
    const oneTime = await screen.findByRole('checkbox', { name: /Einmalkauf/ })
    expect(screen.queryByRole('checkbox', { name: /Team-Abo/ })).not.toBeInTheDocument()
    expect(oneTime).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Auswahl übernehmen' })).toBeDisabled()

    await user.click(oneTime)
    await user.click(screen.getByRole('button', { name: 'Auswahl übernehmen' }))

    await expectStored(repository, id, (project) =>
      expect(project.monetization?.chosenModelIds).toHaveLength(1),
    )
  })

  it('verwirft Preisvorschläge, wenn sich die Modellauswahl während der Anfrage ändert', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject((project) => {
      const seeded = withModels(project)
      const abo = seeded.monetization?.models.find((m) => m.kind === 'subscription')
      return chooseModels(seeded, [abo?.id ?? ''], '')
    })
    const aiProvider = new GatedAiProvider([JSON.stringify(PRICING)])
    open(repository, id, aiProvider)

    await user.click(await screen.findByRole('button', { name: 'Preisstrategien vorschlagen' }))
    await user.click(screen.getByRole('checkbox', { name: /Kostenlos für kleine Teams/ }))
    await user.click(screen.getByRole('button', { name: 'Auswahl übernehmen' }))
    aiProvider.release()

    await waitFor(() => expect(aiProvider.requests).toHaveLength(1))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Preisstrategien vorschlagen' })).toBeEnabled(),
    )
    expect(screen.queryByText('Free, Pro, Team')).not.toBeInTheDocument()
  })

  it('erkennt einen in anderer Sprache übernommenen Hinweis', async () => {
    const { repository, id } = await seedProject((project) => {
      const seeded = withModels(project)
      const abo = seeded.monetization?.models.find((m) => m.kind === 'subscription')
      return updateSection(chooseModels(seeded, [abo?.id ?? ''], ''), 'integrations', {
        content: '- Connect a payment provider (e.g. Stripe or Paddle)',
      })
    })
    open(repository, id)

    expect(
      await screen.findByText('Zahlungsanbieter anbinden (z. B. Stripe oder Paddle)'),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Zahlungsanbieter anbinden/ }),
    ).not.toBeInTheDocument()
  })

  it('ergänzt Modelle und Preisstrategien ohne KI von Hand', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject(ready)
    open(repository, id, new MockAiProvider(), false)

    expect(await screen.findByRole('button', { name: 'Modelle vorschlagen' })).toBeDisabled()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Modell von Hand ergänzen' }),
      'Abo',
    )
    await user.click(screen.getByRole('button', { name: 'Modell hinzufügen' }))

    expect(screen.getByText('Von Hand ergänzt, ohne Bewertung.')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('combobox', { name: 'Modell von Hand ergänzen' })).queryByRole(
        'option',
        { name: 'Abo' },
      ),
    ).toBeNull()

    await user.click(screen.getByRole('checkbox', { name: 'Abo' }))
    await user.click(screen.getByRole('button', { name: 'Auswahl übernehmen' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Preisstrategie von Hand ergänzen' }),
      'Ankerpreis',
    )
    await user.click(screen.getByRole('button', { name: 'Strategie hinzufügen' }))
    await user.click(screen.getByRole('checkbox', { name: 'Ankerpreis' }))
    await user.click(screen.getByRole('button', { name: 'Preisstrategie übernehmen' }))

    expect(screen.getByRole('button', { name: 'Monetarisierung abschließen' })).toBeEnabled()
  })

  it('zeigt KI-Fehler an und setzt die Sektion auf Wunsch zurück', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject(withModels)
    open(repository, id, new MockAiProvider([new AiError('rateLimited', 'zu viele')]))

    await user.click(await screen.findByRole('button', { name: 'Neu vorschlagen' }))
    expect(await screen.findByRole('alert')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Neu beginnen' }))
    expect(await screen.findByRole('button', { name: 'Modelle vorschlagen' })).toBeEnabled()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Neu beginnen' })).not.toBeInTheDocument()
    await expectStored(repository, id, (project) => expect(project.monetization).toBeNull())
  })
})
