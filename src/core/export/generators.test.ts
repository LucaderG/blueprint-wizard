import { makeProject } from '@/core/blueprint/testing'
import { exportLabels } from './testing'
import { generateBlueprint, interviewEntries } from './generators'

describe('Blueprint-Generator', () => {
  it('bewahrt den Projektinhalt und kennzeichnet leere Abschnitte als offen', () => {
    const project = makeProject({ name: 'Koch-Leihbörse' })
    project.blueprint.sections.problem = {
      id: 'problem',
      content: 'Leih dir Küchengeräte.\nRezepte inklusive.',
      maturity: 'vague',
      source: 'user',
    }
    const before = structuredClone(project)
    const result = generateBlueprint(project, exportLabels)
    expect(result).toContain('# Koch-Leihbörse')
    expect(result).toContain('Leih dir Küchengeräte.\nRezepte inklusive.')
    expect(result).toContain('## Zielgruppe & Nutzer\n\n_Reifegrad: leer_\n\nNoch offen.')
    expect(project).toEqual(before)
    expect(result).toMatchSnapshot()
  })
})

describe('Coding-Paket', () => {
  it('liefert alle Startdateien mit verbindlichem Umfang und überprüfbaren Aufgaben', async () => {
    const { generateExportFiles } = await import('./generators')
    const { makeExportProject } = await import('./testing')
    const project = makeExportProject()
    const files = generateExportFiles(project, exportLabels)
    expect(files.map((file) => file.name)).toEqual([
      'BLUEPRINT.md',
      'CLAUDE.md',
      'AGENTS.md',
      'TASKS.md',
      'START-PROMPT.md',
    ])
    expect(files.find((file) => file.name === 'TASKS.md')?.content).toContain(
      'Phase 1: Geräte erfassen. Abnahme: Gerät erscheint in der Liste.',
    )
    expect(files.find((file) => file.name === 'CLAUDE.md')?.content).toContain('- Keine Bezahlung')
    expect(files.find((file) => file.name === 'START-PROMPT.md')?.content).toContain('BLUEPRINT.md')
    expect(files).toMatchSnapshot()
  })
})

describe('Ungeklärter und entschiedener Kontext', () => {
  it('bewahrt Antworten und Entscheidungsfolgen und trennt Empfehlungen von Entscheidungen', async () => {
    const { migrateProject } = await import('@/core/blueprint/migrations')
    const { default: legacy } = await import('@/core/blueprint/__fixtures__/project-v2.json')
    const project = migrateProject(legacy)
    const open = project.decisions.find((decision) => decision.status === 'open')!
    open.recommendedOptionId = open.options[0]!.id
    open.options[0]!.pros = ['Keine Serverkosten']
    open.options[0]!.cons = ['Kein Abgleich']
    open.options[1]!.consequence = ''
    project.decisions.push({
      ...open,
      id: 'dismissed',
      status: 'dismissed',
      title: 'Verworfene Entscheidung',
    })
    project.interview.questions[1]!.why = 'Bestimmt den MVP'
    project.interview.questions[1]!.options = [{ id: 'yes', label: 'Teilen' }]
    project.interview.questions.push({
      ...project.interview.questions[1]!,
      id: 'later',
      status: 'deferred',
    })
    project.additions = [
      {
        id: 'open',
        sectionId: 'features',
        text: 'Erinnerungen',
        reason: 'Rückgaben nicht vergessen',
        status: 'open',
        createdAt: project.createdAt,
        resolvedAt: null,
      },
      {
        id: 'rejected',
        sectionId: 'features',
        text: 'Verworfener Vorschlag',
        reason: '',
        status: 'rejected',
        createdAt: project.createdAt,
        resolvedAt: project.updatedAt,
      },
    ]
    project.interview.analysis = {
      summary: 'Umfang klären',
      gaps: [{ sectionIds: ['features'], text: 'Fehlerfälle fehlen' }],
      contradictions: [{ sectionIds: ['features', 'nonGoals'], text: 'Teilen prüfen' }],
      analyzedAt: project.updatedAt,
      promptVersion: 1,
    }
    project.interview.log.push({
      questionId: 'later',
      questionText: 'Teilen?',
      sectionId: 'features',
      action: 'deferred',
      answerText: '',
      at: project.updatedAt,
    })
    const result = generateBlueprint(project, exportLabels)
    expect(result).toContain('Gewählt: Web-App')
    expect(result).toContain('Folge: Läuft im Browser auf allen Geräten, ohne App-Store')
    expect(result).toContain('Empfehlung, noch keine Entscheidung')
    expect(result).toContain('Familien – Vor allem für mich')
    expect(result).toContain('KI-Vorschlag – noch nicht übernommen')
    expect(result).not.toContain('Verworfene Entscheidung')
    expect(result).not.toContain('Verworfener Vorschlag')
    expect(result).toMatchSnapshot()
  })

  it('kennzeichnet fehlende Roadmap und erhält Markdown sowie ungewöhnliche Projektnamen', async () => {
    const { generateTasks, generateStartPrompt, generateAgentContext } =
      await import('./generators')
    const project = makeProject({ name: 'Name $&\nzweite Zeile' })
    const tasks = generateTasks(project, exportLabels)
    expect(tasks).toContain('Noch keine Projekt-Roadmap festgelegt.')
    expect(generateStartPrompt(project, exportLabels)).toContain('„Name $& zweite Zeile“')
    project.blueprint.sections.problem.content =
      '## Eigene Überschrift\n\n```js\nconst n = 1\n```\n\n| a | b |'
    expect(generateBlueprint(project, exportLabels)).toContain(
      project.blueprint.sections.problem.content,
    )
    expect(generateAgentContext(project, exportLabels)).toContain(
      'Noch nicht entschiedene Abschnitte: Problem & Vision',
    )
  })
})

it('kennzeichnet eine noch nicht übernommene Roadmap auch in der Aufgabenliste', async () => {
  const { generateTasks } = await import('./generators')
  const { makeExportProject } = await import('./testing')
  const project = makeExportProject()
  project.blueprint.sections.roadmap.source = 'aiSuggestion'
  project.blueprint.sections.roadmap.maturity = 'vague'
  const tasks = generateTasks(project, exportLabels)
  expect(tasks).toContain(
    '## Umsetzungs-Roadmap\n\n_Reifegrad: vage_\n\n**KI-Vorschlag – noch nicht übernommen**',
  )
})

describe('Antworten aus v1-Projekten', () => {
  it('exportiert beantwortete Fragen, auch wenn der Verlauf leer ist (Migration v1)', async () => {
    const { migrateProject } = await import('@/core/blueprint/migrations')
    const { default: legacy } = await import('@/core/blueprint/__fixtures__/project-v1.json')
    const project = migrateProject(legacy)
    expect(project.interview.log).toEqual([])

    const result = generateBlueprint(project, exportLabels)
    expect(result).toContain('Ich verliere den Überblick über meine Rezepte.')
  })

  it('doppelt keine Antwort, die schon im Verlauf steht', async () => {
    const { migrateProject } = await import('@/core/blueprint/migrations')
    const { default: legacy } = await import('@/core/blueprint/__fixtures__/project-v2.json')
    const project = migrateProject(legacy)
    const ids = interviewEntries(project).map((e) => `${e.questionId}:${e.action}`)
    expect(new Set(ids).size).toBe(ids.length)
    expect(interviewEntries(project)).toHaveLength(
      project.interview.log.length +
        project.interview.questions.filter(
          (q) =>
            q.status === 'answered' &&
            !project.interview.log.some((e) => e.questionId === q.id && e.action === 'answered'),
        ).length,
    )
  })
})

describe('Monetarisierung im Export', () => {
  const withMonetization = async (status: 'open' | 'decided', kind: 'freemium' | 'none') => {
    const { makeExportProject } = await import('./testing')
    const project = makeExportProject()
    project.monetization = {
      models: [
        {
          id: 'm1',
          kind,
          title: kind === 'none' ? '' : 'Kostenlos für kleine Teams',
          summary: 'Bis 3 Personen kostenlos.',
          fitReason: 'Niedrige Einstiegshürde.',
          concerns: ['Wenige zahlen'],
          scores: null,
          recommended: true,
        },
        {
          id: 'm2',
          kind: 'ads',
          title: 'Nicht gewählt',
          summary: 'Werbung.',
          fitReason: '',
          concerns: [],
          scores: null,
          recommended: false,
        },
      ],
      chosenModelIds: ['m1'],
      modelRationale: 'Teams zahlen für Zusammenarbeit.',
      pricingOptions:
        kind === 'none'
          ? []
          : [
              {
                id: 'p1',
                strategy: 'tiers',
                title: 'Free, Pro, Team',
                summary: 'Drei Pakete.',
                examplePrices: 'Pro: 4–8 € pro Monat',
                reason: 'Leicht verständlich.',
                recommended: true,
              },
            ],
      chosenPricingIds: kind === 'none' ? [] : ['p1'],
      pricingRationale: kind === 'none' ? '' : 'Einfach zu erklären.',
      status,
      decidedAt: status === 'decided' ? '2026-10-12T10:00:00.000Z' : null,
    }
    return project
  }

  it('schreibt Modell, Preisstrategie und Beispielpreise als Annahme in BLUEPRINT.md', async () => {
    const result = generateBlueprint(await withMonetization('decided', 'freemium'), exportLabels)

    expect(result).toContain('## Monetarisierung\n\n_Abgeschlossen_')
    expect(result).toContain('### Modell: Kostenlos für kleine Teams (Freemium)')
    expect(result).toContain('Begründung: Teams zahlen für Zusammenarbeit.')
    expect(result).toContain('### Preisstrategie: Free, Pro, Team (Staffelpreise)')
    expect(result).toContain('Beispielpreise (Annahme, keine Marktdaten): Pro: 4–8 € pro Monat')
    expect(result).not.toContain('Nicht gewählt')
    expect(result.indexOf('## Monetarisierung')).toBeLessThan(result.indexOf('## Offene Punkte'))
    expect(result).toMatchSnapshot()
  })

  it('kennzeichnet eine offene Auswahl und nimmt sie in CLAUDE.md und TASKS.md auf', async () => {
    const { generateExportFiles } = await import('./generators')
    const files = generateExportFiles(await withMonetization('open', 'freemium'), exportLabels)
    const content = (name: string) => files.find((file) => file.name === name)?.content ?? ''

    expect(content('BLUEPRINT.md')).toContain('_Noch nicht abgeschlossen_')
    expect(content('CLAUDE.md')).toContain('### Modell: Kostenlos für kleine Teams (Freemium)')
    expect(content('TASKS.md')).toContain('## Monetarisierung\n\n- [ ] Bezahlfunktion')
  })

  it('braucht bei „nicht monetarisieren“ keine Bezahlaufgabe', async () => {
    const { generateExportFiles } = await import('./generators')
    const files = generateExportFiles(await withMonetization('decided', 'none'), exportLabels)

    expect(files[0]?.content).toContain('### Modell: Nicht monetarisieren')
    expect(files.find((file) => file.name === 'TASKS.md')?.content).not.toContain('Bezahlfunktion')
  })

  it('exportiert ohne gewähltes Modell wie bisher', async () => {
    const { generateExportFiles } = await import('./generators')
    const { makeExportProject } = await import('./testing')
    const before = generateExportFiles(makeExportProject(), exportLabels)
    const project = makeExportProject()
    project.monetization = {
      ...(await withMonetization('open', 'freemium')).monetization!,
      chosenModelIds: [],
      chosenPricingIds: [],
    }

    expect(generateExportFiles(project, exportLabels)).toEqual(before)
  })
})
