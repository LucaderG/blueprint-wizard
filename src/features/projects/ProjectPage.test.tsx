import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { decisionsResultSchema } from '@/core/ai/prompts'
import { updateSection, type Project, type ProjectProfile, type SectionId } from '@/core/blueprint'
import { applyDecisionCandidates, decide } from '@/core/engine'
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

const PROBLEM = 'Problem & Vision'
const AUDIENCE = 'Zielgruppe & Nutzer'

const card = (name: string) => screen.getByRole('article', { name })
const badgeOf = (name: string) => within(card(name)).getByTestId('maturity-badge')
const radio = (name: string, option: string) =>
  within(card(name)).getByRole('radio', { name: option })
const completenessValue = () =>
  Number(screen.getByRole('progressbar', { name: 'Vollständigkeit' }).getAttribute('aria-valuenow'))

/** Legt ein Projekt im Speicher an und wendet optional eine Änderung darauf an. */
async function seedProject(change: (project: Project) => Project = (project) => project) {
  const repository = new MemoryProjectRepository()
  const created = await repository.create('Alpha')
  await repository.save(change(created))
  return { repository, id: created.id }
}

/** Öffnet das Projekt und wartet, bis es geladen ist. */
async function openProject(repository: MemoryProjectRepository, id: string) {
  const rendered = renderRoute(`/projekte/${id}`, { repository })
  await screen.findByRole('heading', { level: 1, name: 'Alpha' })
  return rendered
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

const sectionOf = (project: Project, id: SectionId) => project.blueprint.sections[id]

describe('Projektseite', () => {
  it('zeigt alle Abschnitte mit Reifegrad, Legende und Vollständigkeit', async () => {
    const { repository, id } = await seedProject((project) => {
      const next = updateSection(project, 'problem', {
        content: 'Ein Problem',
        maturity: 'decided',
      })
      return updateSection(next, 'audience', { content: 'Alle', maturity: 'vague' })
    })

    await openProject(repository, id)

    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeVisible()
    const articles = screen.getAllByRole('article')
    expect(articles).toHaveLength(SECTION_NAMES.length)
    SECTION_NAMES.forEach((name, index) => expect(articles[index]).toHaveAccessibleName(name))

    expect(badgeOf(PROBLEM)).toHaveTextContent('entschieden')
    expect(badgeOf(AUDIENCE)).toHaveTextContent('vage')
    expect(badgeOf('Nicht-Ziele')).toHaveTextContent('leer')

    const summary = screen.getByRole('list', { name: 'Reifegrade im Überblick' })
    expect(within(summary).getByText('8 leer')).toBeVisible()
    expect(within(summary).getByText('1 vage')).toBeVisible()
    expect(within(summary).getByText('1 entschieden')).toBeVisible()

    // Problem (3) entschieden und Zielgruppe (2) vage: (3 + 1) / 17 ≈ 24 %.
    expect(completenessValue()).toBe(24)
    expect(screen.getAllByText('Noch leer')).toHaveLength(SECTION_NAMES.length - 2)
  })

  it('zeigt Inhalt als Text mit erhaltenen Zeilenumbrüchen', async () => {
    const { repository, id } = await seedProject((project) =>
      updateSection(project, 'problem', { content: 'Zeile eins\nZeile zwei' }),
    )

    await openProject(repository, id)

    const text = await within(card(PROBLEM)).findByText(/Zeile eins/)
    expect(text).toHaveClass('whitespace-pre-wrap')
    expect(text).toHaveTextContent('Zeile eins Zeile zwei')
  })

  it('übernimmt bearbeiteten Inhalt, setzt die Quelle auf Nutzer und speichert verzögert', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    await openProject(repository, id)

    await user.click(await within(card(PROBLEM)).findByRole('button', { name: 'Bearbeiten' }))
    const textarea = within(card(PROBLEM)).getByRole('textbox', { name: PROBLEM })
    expect(textarea).toHaveFocus()
    await user.type(textarea, 'Zeile eins{Enter}Zeile zwei')
    await user.click(within(card(PROBLEM)).getByRole('button', { name: 'Fertig' }))

    expect(within(card(PROBLEM)).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(card(PROBLEM)).getByText(/Zeile eins/)).toHaveClass('whitespace-pre-wrap')
    expect(badgeOf(PROBLEM)).toHaveTextContent('vage')
    expect(await screen.findByText('Gespeichert')).toBeVisible()

    await expectStored(repository, id, (project) => {
      expect(sectionOf(project, 'problem').content).toBe('Zeile eins\nZeile zwei')
      expect(sectionOf(project, 'problem').source).toBe('user')
      expect(sectionOf(project, 'problem').maturity).toBe('vague')
    })
  })

  it('verwirft den Entwurf bei „Abbrechen“ und bei Escape', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    await openProject(repository, id)

    await user.click(await within(card(PROBLEM)).findByRole('button', { name: 'Bearbeiten' }))
    await user.type(within(card(PROBLEM)).getByRole('textbox'), 'Verworfen')
    await user.click(within(card(PROBLEM)).getByRole('button', { name: 'Abbrechen' }))
    expect(within(card(PROBLEM)).getByText('Noch leer')).toBeVisible()

    await user.click(within(card(PROBLEM)).getByRole('button', { name: 'Bearbeiten' }))
    await user.type(within(card(PROBLEM)).getByRole('textbox'), 'Auch verworfen')
    await user.keyboard('{Escape}')
    expect(within(card(PROBLEM)).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(card(PROBLEM)).getByText('Noch leer')).toBeVisible()

    // Nichts davon wurde gespeichert.
    expect(sectionOf((await repository.get(id))!, 'problem').content).toBe('')
  })

  it('übernimmt mit Strg+Enter', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    await openProject(repository, id)

    await user.click(await within(card(PROBLEM)).findByRole('button', { name: 'Bearbeiten' }))
    await user.type(
      within(card(PROBLEM)).getByRole('textbox'),
      'Schnell fertig{Control>}{Enter}{/Control}',
    )

    expect(within(card(PROBLEM)).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(card(PROBLEM)).getByText('Schnell fertig')).toBeVisible()
    await expectStored(repository, id, (project) =>
      expect(sectionOf(project, 'problem').content).toBe('Schnell fertig'),
    )
  })

  it('ändert den Reifegrad, zeigt die Ampel und aktualisiert Vollständigkeit und Speicher', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject((project) =>
      updateSection(project, 'problem', { content: 'Ein Problem', maturity: 'vague' }),
    )
    await openProject(repository, id)

    expect(await within(card(PROBLEM)).findByText('Ein Problem')).toBeVisible()
    expect(completenessValue()).toBe(9)

    await user.click(radio(PROBLEM, 'entschieden'))

    expect(badgeOf(PROBLEM)).toHaveTextContent('entschieden')
    expect(radio(PROBLEM, 'entschieden')).toBeChecked()
    expect(completenessValue()).toBe(18)
    await expectStored(repository, id, (project) =>
      expect(sectionOf(project, 'problem').maturity).toBe('decided'),
    )
  })

  it('deaktiviert vage und entschieden, solange der Abschnitt leer ist', async () => {
    const { repository, id } = await seedProject()
    await openProject(repository, id)

    await within(card(PROBLEM)).findByText('Noch leer')
    expect(radio(PROBLEM, 'leer')).toBeEnabled()
    expect(radio(PROBLEM, 'vage')).toBeDisabled()
    expect(radio(PROBLEM, 'entschieden')).toBeDisabled()
  })

  it('übernimmt einen KI-Vorschlag', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject((project) =>
      updateSection(project, 'problem', {
        content: 'Vorschlag der KI',
        maturity: 'vague',
        source: 'aiSuggestion',
      }),
    )
    await openProject(repository, id)

    const problem = card(PROBLEM)
    expect(await within(problem).findByText('KI-Vorschlag')).toBeVisible()
    await user.click(within(problem).getByRole('button', { name: 'Übernehmen' }))

    expect(within(problem).queryByText('KI-Vorschlag')).not.toBeInTheDocument()
    expect(within(problem).getByText('Von KI, übernommen')).toBeVisible()
    expect(within(problem).queryByRole('button', { name: 'Übernehmen' })).not.toBeInTheDocument()
    await expectStored(repository, id, (project) =>
      expect(sectionOf(project, 'problem').source).toBe('aiAccepted'),
    )
  })

  it('macht Änderungen mit den Buttons Rückgängig und Wiederholen rückgängig', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject((project) =>
      updateSection(project, 'problem', { content: 'Ein Problem', maturity: 'vague' }),
    )
    await openProject(repository, id)
    await within(card(PROBLEM)).findByText('Ein Problem')

    const undo = screen.getByRole('button', { name: 'Rückgängig' })
    const redo = screen.getByRole('button', { name: 'Wiederholen' })
    expect(undo).toBeDisabled()
    expect(redo).toBeDisabled()

    await user.click(radio(PROBLEM, 'entschieden'))
    expect(undo).toBeEnabled()

    await user.click(undo)
    expect(badgeOf(PROBLEM)).toHaveTextContent('vage')
    expect(undo).toBeDisabled()
    expect(redo).toBeEnabled()

    await user.click(redo)
    expect(badgeOf(PROBLEM)).toHaveTextContent('entschieden')
    expect(redo).toBeDisabled()
  })

  it('reagiert auf Strg+Z, Strg+Umschalt+Z und Strg+Y außerhalb von Textfeldern', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject((project) =>
      updateSection(project, 'problem', { content: 'Ein Problem', maturity: 'vague' }),
    )
    await openProject(repository, id)
    await within(card(PROBLEM)).findByText('Ein Problem')

    // Der Fokus liegt auf einem Radio-Button; das zählt nicht als Textfeld.
    await user.click(radio(PROBLEM, 'entschieden'))
    await user.keyboard('{Control>}z{/Control}')
    expect(badgeOf(PROBLEM)).toHaveTextContent('vage')

    await user.keyboard('{Control>}{Shift>}Z{/Shift}{/Control}')
    expect(badgeOf(PROBLEM)).toHaveTextContent('entschieden')

    await user.keyboard('{Control>}z{/Control}')
    expect(badgeOf(PROBLEM)).toHaveTextContent('vage')
    await user.keyboard('{Control>}y{/Control}')
    expect(badgeOf(PROBLEM)).toHaveTextContent('entschieden')
  })

  it('lässt Strg+Z im Textfeld dem Browser und macht die letzte Änderung nicht rückgängig', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject((project) =>
      updateSection(project, 'problem', { content: 'Ein Problem', maturity: 'vague' }),
    )
    await openProject(repository, id)
    await within(card(PROBLEM)).findByText('Ein Problem')

    await user.click(radio(PROBLEM, 'entschieden'))
    await user.click(within(card(PROBLEM)).getByRole('button', { name: 'Bearbeiten' }))
    await user.type(within(card(PROBLEM)).getByRole('textbox'), 'Weiter')
    await user.keyboard('{Control>}z{/Control}')

    expect(radio(PROBLEM, 'entschieden')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeEnabled()
  })

  it('zeigt bei Speicherfehlern eine Meldung und speichert nach „Erneut versuchen“', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject((project) =>
      updateSection(project, 'problem', { content: 'Ein Problem', maturity: 'vague' }),
    )
    vi.spyOn(repository, 'save').mockRejectedValueOnce(new Error('kaputt'))
    await openProject(repository, id)
    await within(card(PROBLEM)).findByText('Ein Problem')

    await user.click(radio(PROBLEM, 'entschieden'))

    expect(await screen.findByText('Speichern fehlgeschlagen', {}, { timeout: 3000 })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(await screen.findByText('Gespeichert')).toBeVisible()
    await expectStored(repository, id, (project) =>
      expect(sectionOf(project, 'problem').maturity).toBe('decided'),
    )
  })

  it('führt zurück zur Projektliste', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    const { router } = renderRoute(`/projekte/${id}`, { repository })

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

  it('führt über „Fragen beantworten“ zur Fragen-Seite', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    const { router } = renderRoute(`/projekte/${id}`, { repository })
    await screen.findByRole('heading', { level: 1, name: 'Alpha' })

    await user.click(screen.getByRole('link', { name: 'Fragen beantworten' }))

    expect(router.state.location.pathname).toBe(`/projekte/${id}/fragen`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Fragen' })).toBeVisible()
  })

  it('führt über „Entscheidungen & Vorschläge“ zur Entscheidungsseite', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject()
    const { router } = renderRoute(`/projekte/${id}`, { repository })
    await screen.findByRole('heading', { level: 1, name: 'Alpha' })

    await user.click(screen.getByRole('link', { name: 'Entscheidungen & Vorschläge' }))

    expect(router.state.location.pathname).toBe(`/projekte/${id}/entscheidungen`)
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Wichtigste Entscheidungen' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Vorschläge' })).toBeVisible()
  })

  it('zeigt die Zahl der Widersprüche als Warn-Badge am Link', async () => {
    const { repository, id } = await seedProject((project) => {
      const withTech = updateSection(project, 'techStack', {
        content: 'Offline-first mit lokaler Datenbank.',
      })
      return updateSection(withTech, 'features', {
        content: 'Echtzeit-Zusammenarbeit für Teams',
      })
    })

    await openProject(repository, id)

    const link = screen.getByRole('link', { name: /Entscheidungen & Vorschläge/ })
    expect(within(link).getByRole('img', { name: '1 Widerspruch' })).toHaveTextContent('1')
  })

  it('zeigt kein Warn-Badge ohne Widersprüche', async () => {
    const { repository, id } = await seedProject()

    await openProject(repository, id)

    expect(screen.getByRole('link', { name: 'Entscheidungen & Vorschläge' })).toBeVisible()
    expect(screen.queryByRole('img', { name: /Widerspruch/ })).not.toBeInTheDocument()
  })

  it('zeigt das Entscheidungsprotokoll nur, wenn es getroffene Entscheidungen gibt', async () => {
    const { repository, id } = await seedProject((project) => {
      const seeded = applyDecisionCandidates(
        project,
        decisionsResultSchema.parse({
          decisions: [
            {
              sectionId: 'techStack',
              title: 'Web-App oder native App?',
              context: '',
              leverage: 5,
              options: [
                { label: 'Web-App', pros: [], cons: [], consequence: '' },
                { label: 'Native App', pros: [], cons: [], consequence: '' },
              ],
              recommendedOption: null,
            },
          ],
        }),
        { now: new Date() },
      )
      const decision = seeded.decisions[0]!
      return decide(
        seeded,
        decision.id,
        decision.options[1]!.id,
        'Weil es passt.',
        new Date('2026-10-11T10:00:00Z'),
      )
    })

    await openProject(repository, id)

    const heading = screen.getByRole('heading', { level: 2, name: 'Entscheidungsprotokoll' })
    const log = heading.closest('section') as HTMLElement
    expect(
      within(log).getByRole('heading', { level: 3, name: 'Web-App oder native App?' }),
    ).toBeVisible()
    expect(within(log).getByText('Native App')).toBeVisible()
    expect(within(log).getByText('Weil es passt.')).toBeVisible()
    expect(within(log).queryByRole('button')).not.toBeInTheDocument()
  })

  it('zeigt kein Entscheidungsprotokoll ohne getroffene Entscheidungen', async () => {
    const { repository, id } = await seedProject()

    await openProject(repository, id)

    expect(
      screen.queryByRole('heading', { level: 2, name: 'Entscheidungsprotokoll' }),
    ).not.toBeInTheDocument()
  })
})

describe('Steckbrief auf der Projektseite', () => {
  const PROFILE: ProjectProfile = {
    pitch: 'Ein erster Pitch',
    problem: '',
    audience: 'Studierende',
    features: ['Erinnerungen'],
    platform: 'Web',
    monetization: { model: '', priceRange: '', reason: '' },
    effort: 'small',
    risks: [],
  }

  it('zeigt den Steckbrief über den Abschnitten', async () => {
    const { repository, id } = await seedProject((project) => ({ ...project, profile: PROFILE }))

    await openProject(repository, id)

    const card = screen.getByRole('region', { name: 'Steckbrief' })
    expect(within(card).getByText('Ein erster Pitch')).toBeVisible()
    const firstArticle = screen.getAllByRole('article')[0]
    expect(firstArticle).toBeDefined()
    expect(
      card.compareDocumentPosition(firstArticle!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('zeigt ohne Profil keine Karte', async () => {
    const { repository, id } = await seedProject()

    await openProject(repository, id)

    expect(screen.queryByRole('region', { name: 'Steckbrief' })).not.toBeInTheDocument()
  })

  it('speichert einen bearbeiteten Steckbrief automatisch', async () => {
    const user = userEvent.setup()
    const { repository, id } = await seedProject((project) => ({ ...project, profile: PROFILE }))

    await openProject(repository, id)
    const card = screen.getByRole('region', { name: 'Steckbrief' })
    await user.click(within(card).getByRole('button', { name: 'Steckbrief bearbeiten' }))
    const pitch = within(card).getByLabelText('Pitch')
    await user.clear(pitch)
    await user.type(pitch, 'Neuer Pitch')
    await user.click(within(card).getByRole('button', { name: 'Übernehmen' }))

    expect(within(card).getByText('Neuer Pitch')).toBeVisible()
    await expectStored(repository, id, (project) => {
      expect(project.profile?.pitch).toBe('Neuer Pitch')
      expect(project.profile?.features).toEqual(['Erinnerungen'])
    })
  })
})

describe('Eintrag im Papierkorb auf der Projektseite', () => {
  it('zeigt einen Hinweis und speichert den Eintrag in der Bibliothek', async () => {
    const user = userEvent.setup()
    const repository = new MemoryProjectRepository()
    const project = await repository.create('Variante')
    await repository.trash(project.id)

    renderRoute(`/projekte/${project.id}`, { repository })

    expect(
      await screen.findByText(/Dieser Eintrag liegt im Papierkorb \(noch 24 Std\.\)/),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'In der Bibliothek speichern' }))

    expect(
      await screen.findByText('Gespeichert. Der Eintrag steht jetzt in der Bibliothek.'),
    ).toBeVisible()
    expect((await repository.get(project.id))?.library.status).toBe('saved')
  })

  it('zeigt bei gespeicherten Einträgen keinen Hinweis', async () => {
    const repository = new MemoryProjectRepository()
    const project = await repository.create('Gespeichert')

    renderRoute(`/projekte/${project.id}`, { repository })

    expect(await screen.findByRole('heading', { level: 1, name: 'Gespeichert' })).toBeVisible()
    expect(screen.queryByText(/liegt im Papierkorb/)).not.toBeInTheDocument()
  })
})
