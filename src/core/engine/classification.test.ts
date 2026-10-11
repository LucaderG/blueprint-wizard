import { AiError } from '@/core/ai/errors'
import type { Classification } from '@/core/ai/prompts'
import { MockAiProvider } from '@/core/ai/mockProvider'
import { projectSchema, type Project, type Section } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import { makeProject } from '@/core/blueprint/testing'
import { applyClassification, classifyIdea, MAX_IDEA_TEXT_LENGTH } from './classification'

// ---------------------------------------------------------------------------
// Feste Beispiele: Eingabetext der Person und die Antwort des Modells dazu.
// ---------------------------------------------------------------------------

/** Teil-Idee: Rezeptplaner. */
const RECIPE_TEXT =
  'Ich will eine App, mit der ich meine Rezepte für die Woche plane. Am Ende soll automatisch ' +
  'eine Einkaufsliste entstehen. Anfangs nur für mich, vielleicht später für die Familie.'

const RECIPE_ANSWER: Classification = {
  projectName: 'Wochenplaner',
  summary: 'Eine App, die Wochenrezepte plant und daraus eine Einkaufsliste erstellt.',
  sections: [
    {
      id: 'problem',
      content: 'Wochenplanung mit Rezepten kostet Zeit und endet oft ohne Einkaufsliste.',
      maturity: 'vague',
    },
    { id: 'audience', content: 'Zuerst die Person selbst, später die Familie.', maturity: 'vague' },
    {
      id: 'features',
      content: '- Rezepte für die Woche planen\n- Einkaufsliste erzeugen',
      maturity: 'vague',
    },
    { id: 'nonGoals', content: '', maturity: 'empty' },
    { id: 'roadmap', content: '', maturity: 'empty' },
  ],
}

/** Fast fertiges Konzept: Habit-Tracker. */
const HABIT_TEXT =
  'Habit-Tracker als Web-App für Einzelpersonen. Nutzer legen Gewohnheiten an und haken sie täglich ' +
  'ab, dazu gibt es eine Streak-Anzeige. Login per E-Mail und Passwort, Daten in PostgreSQL, ' +
  'Backend mit Node.js. Keine Social-Features und keine Push-Erinnerungen in Version 1. Nach zwei ' +
  'Wochen Beta soll eine Mobile-App folgen.'

const HABIT_ANSWER: Classification = {
  projectName: 'Gewohnheits-Tracker',
  summary: 'Eine Web-App, in der Einzelpersonen tägliche Gewohnheiten abhaken und verfolgen.',
  sections: [
    {
      id: 'problem',
      content: 'Gewohnheiten werden nicht konsequent verfolgt.',
      maturity: 'decided',
    },
    {
      id: 'audience',
      content: 'Einzelpersonen, die Gewohnheiten aufbauen wollen.',
      maturity: 'decided',
    },
    {
      id: 'features',
      content: '- Gewohnheiten anlegen\n- Täglich abhaken\n- Streak-Anzeige',
      maturity: 'decided',
    },
    {
      id: 'nonGoals',
      content: 'Social-Features und Push-Erinnerungen in Version 1.',
      maturity: 'decided',
    },
    { id: 'techStack', content: 'Web-App, Node.js-Backend, PostgreSQL.', maturity: 'decided' },
    {
      id: 'dataModel',
      content: 'Gewohnheiten und tägliche Abhakungen.',
      maturity: 'vague',
    },
    { id: 'roadmap', content: 'Beta nach zwei Wochen, danach Mobile-App.', maturity: 'decided' },
    { id: 'integrations', content: '', maturity: 'empty' },
  ],
}

/** Lose Gedanken ohne konkrete Idee. */
const LOOSE_TEXT =
  'Ich würde gern etwas mit Pflanzen machen, vielleicht eine Gieß-Erinnerung oder so. ' +
  'Keine Ahnung, was genau. Irgendwas, das mir Spaß macht.'

const LOOSE_ANSWER: Classification = {
  projectName: null,
  summary: 'Eine lose Idee rund um Pflanzenpflege, noch ohne klare Richtung.',
  sections: [
    { id: 'problem', content: 'Pflanzen werden vergessen zu gießen.', maturity: 'vague' },
    { id: 'features', content: 'Vielleicht eine Gieß-Erinnerung.', maturity: 'vague' },
    { id: 'audience', content: '', maturity: 'empty' },
  ],
}

// ---------------------------------------------------------------------------
// classifyIdea
// ---------------------------------------------------------------------------

describe('classifyIdea', () => {
  it('ordnet einen Teil-Idee-Text ein (Rezeptplaner)', async () => {
    const provider = new MockAiProvider([JSON.stringify(RECIPE_ANSWER)])

    const result = await classifyIdea({
      provider,
      text: RECIPE_TEXT,
      entryPoint: 'partialIdea',
      language: 'de',
    })

    expect(result.classification).toEqual(RECIPE_ANSWER)
    expect(result.calls).toHaveLength(1)
    expect(result.promptId).toBe('classify-idea')
    expect(result.promptVersion).toBe(1)
    expect(provider.requests[0]?.messages[1]?.content).toContain(RECIPE_TEXT)
  })

  it('ordnet ein fast fertiges Konzept ein (Habit-Tracker)', async () => {
    const provider = new MockAiProvider([JSON.stringify(HABIT_ANSWER)])

    const result = await classifyIdea({
      provider,
      text: HABIT_TEXT,
      entryPoint: 'almostDone',
      language: 'de',
    })

    expect(result.classification).toEqual(HABIT_ANSWER)
    expect(result.classification.sections.filter((s) => s.maturity === 'decided')).toHaveLength(6)
    expect(provider.requests[0]?.messages[0]?.content).toContain('fast fertiges Konzept')
  })

  it('ordnet lose Gedanken ohne Projektnamen ein', async () => {
    const provider = new MockAiProvider([JSON.stringify(LOOSE_ANSWER)])

    const result = await classifyIdea({
      provider,
      text: LOOSE_TEXT,
      entryPoint: 'noIdea',
      language: 'de',
    })

    expect(result.classification.projectName).toBeNull()
    expect(result.classification.sections.map((s) => s.id)).toEqual([
      'problem',
      'features',
      'audience',
    ])
    expect(provider.requests[0]?.messages[0]?.content).toContain('noch keine konkrete Idee')
  })

  it('sendet das JSON-Schema „idea_classification“ mit Standardtemperatur 0,2', async () => {
    const provider = new MockAiProvider([JSON.stringify(LOOSE_ANSWER)])

    await classifyIdea({ provider, text: LOOSE_TEXT, entryPoint: 'noIdea', language: 'de' })

    const request = provider.requests[0]
    expect(request?.jsonSchema?.name).toBe('idea_classification')
    expect(request?.jsonSchema?.schema).toMatchObject({ type: 'object' })
    expect(request?.temperature).toBe(0.2)
  })

  it('übernimmt eine abweichende Temperatur', async () => {
    const provider = new MockAiProvider([JSON.stringify(LOOSE_ANSWER)])

    await classifyIdea({
      provider,
      text: LOOSE_TEXT,
      entryPoint: 'noIdea',
      language: 'de',
      temperature: 0.7,
    })

    expect(provider.requests[0]?.temperature).toBe(0.7)
  })

  it('reicht das Abbruch-Signal an den Anbieter weiter', async () => {
    const provider = new MockAiProvider([JSON.stringify(LOOSE_ANSWER)])
    const controller = new AbortController()

    await classifyIdea({
      provider,
      text: LOOSE_TEXT,
      entryPoint: 'noIdea',
      language: 'de',
      signal: controller.signal,
    })

    expect(provider.requests[0]?.signal).toBe(controller.signal)
  })

  it('schneidet den Text vor dem Senden ab', async () => {
    const provider = new MockAiProvider([JSON.stringify(LOOSE_ANSWER)])

    await classifyIdea({
      provider,
      text: `  \n${LOOSE_TEXT}\n\t `,
      entryPoint: 'noIdea',
      language: 'de',
    })

    expect(provider.requests[0]?.messages[1]?.content).toBe(
      `Text der Person:\n"""\n${LOOSE_TEXT}\n"""`,
    )
  })

  it.each(['', '   ', '\n\t\n'])(
    'wirft RangeError für leeren Text %j, ohne den Anbieter zu fragen',
    async (text) => {
      const provider = new MockAiProvider()

      await expect(
        classifyIdea({ provider, text, entryPoint: 'noIdea', language: 'de' }),
      ).rejects.toBeInstanceOf(RangeError)
      expect(provider.requests).toHaveLength(0)
    },
  )

  it('wirft RangeError für zu langen Text, ohne den Anbieter zu fragen', async () => {
    const provider = new MockAiProvider()
    const tooLong = 'a'.repeat(MAX_IDEA_TEXT_LENGTH + 1)

    await expect(
      classifyIdea({ provider, text: tooLong, entryPoint: 'noIdea', language: 'de' }),
    ).rejects.toThrow(RangeError)
    expect(provider.requests).toHaveLength(0)
  })

  it('zählt die Länge erst nach dem Abschneiden der Leerzeichen', async () => {
    const provider = new MockAiProvider([JSON.stringify(LOOSE_ANSWER)])
    const padded = `  ${'a'.repeat(MAX_IDEA_TEXT_LENGTH)}  `

    await classifyIdea({ provider, text: padded, entryPoint: 'noIdea', language: 'de' })

    expect(provider.requests).toHaveLength(1)
  })

  it('repariert eine ungültige erste Antwort mit einem zweiten Aufruf', async () => {
    const broken = 'Hier ist meine Einordnung: nicht als JSON'
    const provider = new MockAiProvider([broken, JSON.stringify(LOOSE_ANSWER)])

    const result = await classifyIdea({
      provider,
      text: LOOSE_TEXT,
      entryPoint: 'noIdea',
      language: 'de',
    })

    expect(result.calls).toHaveLength(2)
    expect(result.calls[0]?.text).toBe(broken)
    expect(result.classification).toEqual(LOOSE_ANSWER)
    expect(provider.requests).toHaveLength(2)
    const repair = provider.requests[1]?.messages ?? []
    expect(repair.at(-2)).toEqual({ role: 'assistant', content: broken })
    expect(repair.at(-1)?.content).toContain('Deine Antwort passt nicht')
  })

  it('wirft AiError „invalidResponse“, wenn auch der Reparaturversuch scheitert', async () => {
    const provider = new MockAiProvider(['kaputt', 'immer noch kaputt'])

    await expect(
      classifyIdea({ provider, text: LOOSE_TEXT, entryPoint: 'noIdea', language: 'de' }),
    ).rejects.toMatchObject({ code: 'invalidResponse' })
    expect(provider.requests).toHaveLength(2)
  })

  it('gibt Fehler des Anbieters unverändert weiter', async () => {
    const provider = new MockAiProvider([new AiError('rateLimited', 'Zu viele Anfragen')])

    await expect(
      classifyIdea({ provider, text: LOOSE_TEXT, entryPoint: 'noIdea', language: 'de' }),
    ).rejects.toMatchObject({ code: 'rateLimited' })
  })
})

// ---------------------------------------------------------------------------
// applyClassification
// ---------------------------------------------------------------------------

type SectionSpec = Classification['sections']

function classification(
  sections: SectionSpec,
  projectName: string | null = 'KI-Name',
): Classification {
  return { projectName, summary: 'Zusammenfassung', sections }
}

function withSection(project: Project, id: SectionId, part: Partial<Section>): Project {
  return {
    ...project,
    blueprint: {
      sections: {
        ...project.blueprint.sections,
        [id]: { ...project.blueprint.sections[id], ...part },
      },
    },
  }
}

describe('applyClassification', () => {
  it('füllt leere Abschnitte als KI-Vorschlag mit getrimmtem Inhalt', () => {
    const result = applyClassification(
      makeProject(),
      classification([{ id: 'problem', content: '  Klar umrissen  ', maturity: 'decided' }]),
      'almostDone',
    )

    expect(result.project.blueprint.sections.problem).toEqual({
      ...makeProject().blueprint.sections.problem,
      content: 'Klar umrissen',
      maturity: 'decided',
      source: 'aiSuggestion',
    })
    expect(result.updated).toEqual(['problem'])
    expect(result.kept).toEqual([])
  })

  it('überspringt Vorschläge mit Reife „empty“ oder ohne Inhalt', () => {
    const project = makeProject()

    const result = applyClassification(
      project,
      classification([
        { id: 'audience', content: 'Text', maturity: 'empty' },
        { id: 'features', content: '  \n ', maturity: 'vague' },
      ]),
      'noIdea',
    )

    expect(result.updated).toEqual([])
    expect(result.kept).toEqual([])
    expect(result.project.blueprint.sections.audience).toBe(project.blueprint.sections.audience)
    expect(result.project.blueprint.sections.features).toBe(project.blueprint.sections.features)
  })

  it('ersetzt nie eigenen Inhalt des Nutzers und meldet ihn als „kept“', () => {
    const project = withSection(makeProject(), 'problem', {
      content: 'Meine eigene Beschreibung',
      maturity: 'decided',
      source: 'user',
    })

    const result = applyClassification(
      project,
      classification([{ id: 'problem', content: 'KI-Text', maturity: 'vague' }]),
      'partialIdea',
    )

    expect(result.kept).toEqual(['problem'])
    expect(result.updated).toEqual([])
    expect(result.project.blueprint.sections.problem).toBe(project.blueprint.sections.problem)
  })

  it('überschreibt Nutzerinhalt, der nur aus Leerzeichen besteht', () => {
    const project = withSection(makeProject(), 'problem', { content: '   ', source: 'user' })

    const result = applyClassification(
      project,
      classification([{ id: 'problem', content: 'KI-Text', maturity: 'vague' }]),
      'partialIdea',
    )

    expect(result.updated).toEqual(['problem'])
    expect(result.project.blueprint.sections.problem.content).toBe('KI-Text')
  })

  it.each(['aiSuggestion', 'aiAccepted'] as const)(
    'überschreibt früheren KI-Inhalt (%s) und markiert ihn wieder als Vorschlag',
    (source) => {
      const project = withSection(makeProject(), 'risks', {
        content: 'Alt',
        maturity: 'vague',
        source,
      })

      const result = applyClassification(
        project,
        classification([{ id: 'risks', content: 'Neu', maturity: 'decided' }]),
        'partialIdea',
      )

      expect(result.updated).toEqual(['risks'])
      expect(result.project.blueprint.sections.risks).toMatchObject({
        content: 'Neu',
        maturity: 'decided',
        source: 'aiSuggestion',
      })
    },
  )

  it('setzt den Einstiegspunkt', () => {
    const result = applyClassification(makeProject(), classification([]), 'almostDone')

    expect(result.project.entryPoint).toBe('almostDone')
  })

  it('übernimmt den Projektnamen nur mit useSuggestedName', () => {
    const project = makeProject({ name: 'Mein Name' })
    const suggestion = classification([], 'KI-Name')

    expect(applyClassification(project, suggestion, 'noIdea').project.name).toBe('Mein Name')
    expect(
      applyClassification(project, suggestion, 'noIdea', { useSuggestedName: false }).project.name,
    ).toBe('Mein Name')
    expect(
      applyClassification(project, suggestion, 'noIdea', { useSuggestedName: true }).project.name,
    ).toBe('KI-Name')
  })

  it.each([
    ['null', null],
    ['leer', ''],
    ['nur Leerzeichen', '   '],
    ['zu lang (121 Zeichen)', 'a'.repeat(121)],
  ])('behält den Namen, wenn der Vorschlag %s ist', (_label, projectName) => {
    const project = makeProject({ name: 'Mein Name' })

    const result = applyClassification(project, classification([], projectName), 'noIdea', {
      useSuggestedName: true,
    })

    expect(result.project.name).toBe('Mein Name')
  })

  it('akzeptiert einen Namen mit genau 120 Zeichen und trimmt ihn', () => {
    const name = `  ${'a'.repeat(120)}  `

    const result = applyClassification(makeProject(), classification([], name), 'noIdea', {
      useSuggestedName: true,
    })

    expect(result.project.name).toBe('a'.repeat(120))
  })

  it('ändert das Eingabeprojekt nicht', () => {
    const project = makeProject({ name: 'Mein Name' })
    const snapshot = structuredClone(project)

    applyClassification(
      project,
      classification([{ id: 'problem', content: 'Text', maturity: 'vague' }], 'Neu'),
      'partialIdea',
      { useSuggestedName: true },
    )

    expect(project).toEqual(snapshot)
  })

  it('liefert ein Projekt, das das Projektschema erfüllt', () => {
    const result = applyClassification(
      makeProject(),
      classification(HABIT_ANSWER.sections, HABIT_ANSWER.projectName),
      'almostDone',
      { useSuggestedName: true },
    )

    expect(projectSchema.parse(result.project)).toEqual(result.project)
    expect(result.project.name).toBe('Gewohnheits-Tracker')
  })

  describe('mit den Beispieltexten', () => {
    it('Teil-Idee: füllt die Vorschläge und lässt leere Abschnitte leer', async () => {
      const provider = new MockAiProvider([JSON.stringify(RECIPE_ANSWER)])
      const { classification: parsed } = await classifyIdea({
        provider,
        text: RECIPE_TEXT,
        entryPoint: 'partialIdea',
        language: 'de',
      })

      const result = applyClassification(makeProject(), parsed, 'partialIdea', {
        useSuggestedName: true,
      })

      expect(result.updated).toEqual(['problem', 'audience', 'features'])
      expect(result.kept).toEqual([])
      expect(result.project.name).toBe('Wochenplaner')
      expect(result.project.entryPoint).toBe('partialIdea')
      expect(result.project.blueprint.sections.features.maturity).toBe('vague')
      expect(result.project.blueprint.sections.nonGoals.source).toBe('user')
      expect(result.project.blueprint.sections.nonGoals.content).toBe('')
    })

    it('fast fertig: übernimmt Entscheidungen, respektiert eigenen Inhalt', async () => {
      const provider = new MockAiProvider([JSON.stringify(HABIT_ANSWER)])
      const { classification: parsed } = await classifyIdea({
        provider,
        text: HABIT_TEXT,
        entryPoint: 'almostDone',
        language: 'de',
      })
      const project = withSection(makeProject(), 'problem', {
        content: 'Eigene Problemanalyse',
        maturity: 'decided',
        source: 'user',
      })

      const result = applyClassification(project, parsed, 'almostDone')

      expect(result.kept).toEqual(['problem'])
      expect(result.updated).toEqual([
        'audience',
        'features',
        'nonGoals',
        'techStack',
        'dataModel',
        'roadmap',
      ])
      expect(result.project.name).toBe('Testprojekt')
      expect(result.project.blueprint.sections.problem.content).toBe('Eigene Problemanalyse')
      expect(result.project.blueprint.sections.techStack).toMatchObject({
        maturity: 'decided',
        source: 'aiSuggestion',
      })
    })

    it('keine Idee: ohne Projektnamen bleibt der Name, Vorschläge kommen als KI-Inhalt', async () => {
      const provider = new MockAiProvider([JSON.stringify(LOOSE_ANSWER)])
      const { classification: parsed } = await classifyIdea({
        provider,
        text: LOOSE_TEXT,
        entryPoint: 'noIdea',
        language: 'de',
      })

      const result = applyClassification(makeProject({ name: 'Mein Name' }), parsed, 'noIdea', {
        useSuggestedName: true,
      })

      expect(result.updated).toEqual(['problem', 'features'])
      expect(result.project.name).toBe('Mein Name')
      expect(result.project.blueprint.sections.problem.content).toBe(
        'Pflanzen werden vergessen zu gießen.',
      )
    })
  })
})
