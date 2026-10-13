import { AiError, MockAiProvider, type IdeaCandidate, type IdeaRequest } from '@/core/ai'
import {
  PROJECT_NAME_MAX_LENGTH,
  profileSchema,
  projectNameSchema,
  projectSchema,
  type Project,
} from '@/core/blueprint/schema'
import { makeProject } from '@/core/blueprint/testing'
import { EMPTY_PROFILE, type IdeationProfile } from '@/core/ideation/profile'
import type { Idea, IdeationSession } from '@/core/ideation/session'
import {
  applyChosenIdea,
  applyIdeas,
  cleanIdeaCandidates,
  generateIdeas,
  ideaToClassification,
  ideaToDraft,
  MAX_IDEA_FEATURES,
  MAX_IDEAS,
  MAX_SEEN_TITLES,
  titlesToAvoid,
} from './ideation'

// ---------------------------------------------------------------------------
// Feste Beispiele
// ---------------------------------------------------------------------------

/** Fortlaufende, feste IDs für die Tests. */
const counterIds = () => {
  let n = 0
  return () => `id-${++n}`
}

/** Eine KI-Kandidatin mit gültigen Werten; `overrides` ändert einzelne Felder. */
function candidate(title: string, overrides: Partial<IdeaCandidate> = {}): IdeaCandidate {
  return {
    title,
    pitch: `Worum es bei ${title} geht.`,
    problem: `Problem von ${title}.`,
    audience: 'Musikfans',
    features: ['Funktion eins', 'Funktion zwei'],
    platform: 'Web-App',
    effort: 'small',
    novelty: 3,
    learningValue: 2,
    learningNote: `Lernt man bei ${title}.`,
    ...overrides,
  }
}

const IDEA_A: Idea = {
  id: 'idea-a',
  title: 'Playlist-Tagebuch',
  pitch: 'Notiert, welche Songs man wann gehört hat.',
  problem: 'Man vergisst, was man schon gehört hat.',
  audience: 'Musikliebhaber',
  features: ['Songs notieren', 'Monatsrückblick'],
  platform: 'Web-App',
  effort: 'small',
  novelty: 3,
  learningValue: 2,
  learningNote: 'Wie man Daten im Browser speichert.',
}

const IDEA_B: Idea = {
  id: 'idea-b',
  title: 'Rezept-Mixer',
  pitch: 'Kombiniert Vorräte mit Rezepten.',
  problem: 'Man kauft doppelt ein.',
  audience: 'Haushalte',
  features: ['Vorräte erfassen'],
  platform: 'Smartphone-App',
  effort: 'medium',
  novelty: 4,
  learningValue: 4,
  learningNote: 'Wie man Listen durchsucht.',
}

/** Sitzung mit zwei Ideen und deren Titeln als „schon gezeigt“. */
function makeSession(overrides: Partial<IdeationSession> = {}): IdeationSession {
  return {
    profile: { ...EMPTY_PROFILE, interests: ['Musik'] },
    ideas: [IDEA_A, IDEA_B],
    seenTitles: ['Playlist-Tagebuch', 'Rezept-Mixer'],
    ...overrides,
  }
}

const titles = (items: readonly { title: string }[]) => items.map((i) => i.title)

const FULL_PROFILE: IdeationProfile = {
  interests: ['Musik'],
  skills: ['TypeScript'],
  availableTime: 'fewEvenings',
  learningGoal: 'Audio lernen',
  frustrations: 'Playlists gehen verloren',
  platform: 'web',
}

/** Eine gültige KI-Antwort im Format „ideas“ als JSON-Text. */
const ideasJson = (...candidates: IdeaCandidate[]) => JSON.stringify({ ideas: candidates })

// ---------------------------------------------------------------------------
// cleanIdeaCandidates
// ---------------------------------------------------------------------------

describe('cleanIdeaCandidates', () => {
  const options = () => ({ limit: 10, createId: counterIds() })

  it('wirft Ideen ohne Titel oder ohne Kurzbeschreibung weg', () => {
    const result = cleanIdeaCandidates(
      [candidate('  '), candidate('Ohne Pitch', { pitch: ' ' }), candidate('Gültig')],
      options(),
    )
    expect(titles(result)).toEqual(['Gültig'])
  })

  it('wirft doppelte Titel weg, ohne Groß-/Kleinschreibung und Leerraum zu beachten', () => {
    const result = cleanIdeaCandidates(
      [candidate('Alpha'), candidate(' alpha '), candidate('Beta Test'), candidate(' beta  test ')],
      options(),
    )
    expect(titles(result)).toEqual(['Alpha', 'Beta Test'])
  })

  it('wirft Titel weg, die in avoidTitles stehen', () => {
    const result = cleanIdeaCandidates([candidate('Alpha'), candidate('Beta')], {
      ...options(),
      avoidTitles: ['beta  '],
    })
    expect(titles(result)).toEqual(['Alpha'])
  })

  it.each<[number, number]>([
    [0, 1],
    [-2, 1],
    [9, 5],
    [2.4, 2],
    [2.6, 3],
    [Number.NaN, 3],
    [Number.POSITIVE_INFINITY, 3],
  ])('begrenzt Neuheit %s auf %s', (value, expected) => {
    const [idea] = cleanIdeaCandidates([candidate('X', { novelty: value })], options())
    expect(idea?.novelty).toBe(expected)
  })

  it.each<[number, number]>([
    [-5, 1],
    [7, 5],
    [Number.NaN, 3],
  ])('begrenzt Lernwert %s auf %s', (value, expected) => {
    const [idea] = cleanIdeaCandidates([candidate('X', { learningValue: value })], options())
    expect(idea?.learningValue).toBe(expected)
  })

  it('entfernt Aufzählungszeichen aus den Kernfunktionen', () => {
    const [idea] = cleanIdeaCandidates(
      [candidate('X', { features: ['- Eins', '* Zwei', '+ Drei', '1. Vier', '2) Fünf', 'Sechs'] })],
      options(),
    )
    expect(idea?.features).toEqual(['Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs'])
  })

  it('verwirft Kernfunktionen, die nach dem Entfernen leer sind, und Dubletten', () => {
    const [idea] = cleanIdeaCandidates(
      [candidate('X', { features: ['- ', 'Eins', '- eins', '  '] })],
      options(),
    )
    expect(idea?.features).toEqual(['Eins'])
  })

  it(`begrenzt die Kernfunktionen auf MAX_IDEA_FEATURES (${MAX_IDEA_FEATURES})`, () => {
    const features = Array.from({ length: MAX_IDEA_FEATURES + 3 }, (_, i) => `F${i}`)
    const [idea] = cleanIdeaCandidates([candidate('X', { features })], options())
    expect(idea?.features).toHaveLength(MAX_IDEA_FEATURES)
  })

  it('begrenzt die Anzahl auf limit und verwirft ungültige Ideen dabei nicht mitgezählt', () => {
    const result = cleanIdeaCandidates(
      [candidate(''), candidate('Eins'), candidate('Zwei'), candidate('Drei')],
      { limit: 2, createId: counterIds() },
    )
    expect(titles(result)).toEqual(['Eins', 'Zwei'])
  })

  it('trimmt Freitexte und übernimmt Aufwand', () => {
    const [idea] = cleanIdeaCandidates(
      [
        candidate('  Titel  ', {
          pitch: '  Pitch  ',
          problem: ' Problem ',
          audience: ' Zielgruppe ',
          platform: ' Web ',
          learningNote: ' Lernen ',
          effort: 'large',
        }),
      ],
      options(),
    )
    expect(idea).toMatchObject({
      title: 'Titel',
      pitch: 'Pitch',
      problem: 'Problem',
      audience: 'Zielgruppe',
      platform: 'Web',
      learningNote: 'Lernen',
      effort: 'large',
    })
  })

  it('vergibt IDs über createId', () => {
    const result = cleanIdeaCandidates([candidate('Eins'), candidate('Zwei')], options())
    expect(result.map((i) => i.id)).toEqual(['id-1', 'id-2'])
  })

  it('liefert für leere Eingaben eine leere Liste', () => {
    expect(cleanIdeaCandidates([], options())).toEqual([])
  })

  it('vergibt ohne createId eine UUID', () => {
    const [idea] = cleanIdeaCandidates([candidate('Eins')], { limit: 1 })
    expect(idea?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})

// ---------------------------------------------------------------------------
// titlesToAvoid
// ---------------------------------------------------------------------------

describe('titlesToAvoid', () => {
  const session = makeSession()

  it('verbietet bei generate und moreLike die bisher gezeigten Titel', () => {
    expect(titlesToAvoid(session, { kind: 'generate' })).toEqual(session.seenTitles)
    expect(titlesToAvoid(session, { kind: 'moreLike', idea: IDEA_A })).toEqual(session.seenTitles)
  })

  it('verbietet bei refine nur die Titel der anderen Karten', () => {
    expect(
      titlesToAvoid(session, { kind: 'refine', idea: IDEA_A, direction: 'bolder', note: '' }),
    ).toEqual(['Rezept-Mixer'])
  })

  it('verbietet bei combine die Titel aller Karten außer den Ausgangsideen', () => {
    const third = { ...IDEA_B, id: 'idea-c', title: 'Gießplan' }
    const withThird = makeSession({ ideas: [IDEA_A, IDEA_B, third] })
    expect(titlesToAvoid(withThird, { kind: 'combine', ideas: [IDEA_A, IDEA_B] })).toEqual([
      'Gießplan',
    ])
  })
})

// ---------------------------------------------------------------------------
// applyIdeas
// ---------------------------------------------------------------------------

describe('cleanIdeaCandidates – Titellänge', () => {
  it('kürzt Titel auf die Höchstlänge eines Projektnamens und fasst Leerraum zusammen', () => {
    const long = `${'Sehr  lange '.repeat(20)}Idee`
    const [idea] = cleanIdeaCandidates([candidate(long)], { limit: 1, createId: counterIds() })
    expect(idea?.title.length).toBeLessThanOrEqual(PROJECT_NAME_MAX_LENGTH)
    expect(idea?.title).not.toMatch(/\s{2}/)
    expect(projectNameSchema.safeParse(idea?.title).success).toBe(true)
  })
})

describe('applyIdeas', () => {
  const four = () => [
    candidate('Neu 1'),
    candidate('Neu 2'),
    candidate('Neu 3'),
    candidate('Neu 4'),
  ]

  describe('generate', () => {
    it('ersetzt die Liste durch die neuen Ideen', () => {
      const next = applyIdeas(makeSession(), { kind: 'generate' }, four(), {
        createId: counterIds(),
      })
      expect(titles(next.ideas)).toEqual(['Neu 1', 'Neu 2', 'Neu 3', 'Neu 4'])
    })

    it('übernimmt keinen bereits gezeigten Titel', () => {
      const next = applyIdeas(
        makeSession(),
        { kind: 'generate' },
        [candidate('playlist-tagebuch'), candidate('Neu 1')],
        { createId: counterIds() },
      )
      expect(titles(next.ideas)).toEqual(['Neu 1'])
    })

    it('wächst die Liste der gezeigten Titel um die neuen Titel', () => {
      const next = applyIdeas(makeSession(), { kind: 'generate' }, four(), {
        createId: counterIds(),
      })
      expect(next.seenTitles).toEqual([
        'Playlist-Tagebuch',
        'Rezept-Mixer',
        'Neu 1',
        'Neu 2',
        'Neu 3',
        'Neu 4',
      ])
    })

    it(`begrenzt die gemerkten Titel auf MAX_SEEN_TITLES (${MAX_SEEN_TITLES})`, () => {
      const seen = Array.from({ length: MAX_SEEN_TITLES }, (_, i) => `Titel ${i}`)
      const next = applyIdeas(makeSession({ seenTitles: seen }), { kind: 'generate' }, four(), {
        createId: counterIds(),
      })
      expect(next.seenTitles).toHaveLength(MAX_SEEN_TITLES)
      expect(next.seenTitles[0]).toBe('Titel 4')
      expect(next.seenTitles.at(-1)).toBe('Neu 4')
    })

    it('lässt die Sitzung bei einem leeren Ergebnis unverändert (gleiche Referenz)', () => {
      const session = makeSession()
      const result = applyIdeas(session, { kind: 'generate' }, [candidate(' ')], {
        createId: counterIds(),
      })
      expect(result).toBe(session)
    })

    it('lässt die Sitzung unverändert, wenn alle Ideen schon gezeigt wurden', () => {
      const session = makeSession()
      const result = applyIdeas(
        session,
        { kind: 'generate' },
        [candidate('Playlist-Tagebuch'), candidate('Rezept-Mixer')],
        { createId: counterIds() },
      )
      expect(result).toBe(session)
    })
  })

  describe('moreLike', () => {
    it('behält das Vorbild vorn und hängt die neuen Ideen dahinter', () => {
      const next = applyIdeas(makeSession(), { kind: 'moreLike', idea: IDEA_A }, four(), {
        createId: counterIds(),
      })
      expect(titles(next.ideas)).toEqual(['Playlist-Tagebuch', 'Neu 1', 'Neu 2', 'Neu 3', 'Neu 4'])
      expect(next.ideas[0]).toEqual(IDEA_A)
    })

    it('nimmt das Vorbild aus der Sitzung, nicht die Kopie aus der Anfrage', () => {
      const staleCopy = { ...IDEA_A, title: 'Veralteter Titel' }
      const next = applyIdeas(
        makeSession(),
        { kind: 'moreLike', idea: staleCopy },
        [candidate('Neu 1')],
        { createId: counterIds() },
      )
      expect(next.ideas[0]).toEqual(IDEA_A)
    })

    it('nimmt das Vorbild aus der Anfrage, wenn es nicht (mehr) in der Sitzung steht', () => {
      const orphan: Idea = { ...IDEA_A, id: 'fremd', title: 'Fremde Idee' }
      const next = applyIdeas(
        makeSession({ ideas: [IDEA_B] }),
        { kind: 'moreLike', idea: orphan },
        [candidate('Neu 1')],
        { createId: counterIds() },
      )
      expect(next.ideas[0]).toEqual(orphan)
    })

    it(`begrenzt auf MAX_IDEAS (${MAX_IDEAS})`, () => {
      const next = applyIdeas(makeSession(), { kind: 'moreLike', idea: IDEA_A }, four(), {
        createId: counterIds(),
      })
      expect(next.ideas.length).toBeLessThanOrEqual(MAX_IDEAS)
    })
  })

  describe('refine', () => {
    const refined = [candidate('Einfacher')]
    const request = (idea: Idea): IdeaRequest => ({
      kind: 'refine',
      idea,
      direction: 'simpler',
      note: '',
    })

    it('ersetzt die Idee an derselben Stelle', () => {
      const next = applyIdeas(makeSession(), request(IDEA_B), refined, {
        createId: counterIds(),
      })
      expect(titles(next.ideas)).toEqual(['Playlist-Tagebuch', 'Einfacher'])
    })

    it('ersetzt die erste Idee an Position 0', () => {
      const next = applyIdeas(makeSession(), request(IDEA_A), refined, {
        createId: counterIds(),
      })
      expect(titles(next.ideas)).toEqual(['Einfacher', 'Rezept-Mixer'])
    })

    it('setzt die Idee vorn ein, wenn sie unbekannt ist', () => {
      const unknown: Idea = { ...IDEA_A, id: 'unbekannt' }
      const next = applyIdeas(makeSession(), request(unknown), refined, {
        createId: counterIds(),
      })
      expect(titles(next.ideas)).toEqual(['Einfacher', 'Playlist-Tagebuch', 'Rezept-Mixer'])
    })

    it('darf den Titel der Ausgangsidee behalten', () => {
      const next = applyIdeas(makeSession(), request(IDEA_A), [candidate('Playlist-Tagebuch')], {
        createId: counterIds(),
      })
      expect(next.ideas[0]?.title).toBe('Playlist-Tagebuch')
    })

    it('übernimmt nur eine Idee, auch wenn die KI mehrere liefert', () => {
      const next = applyIdeas(
        makeSession(),
        request(IDEA_B),
        [candidate('Erste'), candidate('Zweite')],
        { createId: counterIds() },
      )
      expect(titles(next.ideas)).toEqual(['Playlist-Tagebuch', 'Erste'])
    })
  })

  describe('combine', () => {
    const request: IdeaRequest = { kind: 'combine', ideas: [IDEA_A, IDEA_B] }

    it('stellt die kombinierte Idee vorn und behält die Ausgangsideen', () => {
      const next = applyIdeas(makeSession(), request, [candidate('Kombi')], {
        createId: counterIds(),
      })
      expect(titles(next.ideas)).toEqual(['Kombi', 'Playlist-Tagebuch', 'Rezept-Mixer'])
    })

    it(`begrenzt auf MAX_IDEAS (${MAX_IDEAS}) und lässt die kombinierte Idee vorn`, () => {
      const five = [
        IDEA_A,
        IDEA_B,
        ...Array.from({ length: 3 }, (_, i) => ({ ...IDEA_B, id: `x${i}`, title: `Weitere ${i}` })),
      ]
      const next = applyIdeas(makeSession({ ideas: five }), request, [candidate('Kombi')], {
        createId: counterIds(),
      })
      expect(next.ideas).toHaveLength(MAX_IDEAS)
      expect(next.ideas[0]?.title).toBe('Kombi')
    })

    it('streicht beim Kürzen andere Ideen, nie die Ausgangsideen', () => {
      const others = Array.from({ length: 3 }, (_, i) => ({
        ...IDEA_B,
        id: `x${i}`,
        title: `Weitere ${i}`,
      }))
      // Die Ausgangsideen stehen hinten und wären bei einfachem Abschneiden weg.
      const next = applyIdeas(
        makeSession({ ideas: [...others, IDEA_A, IDEA_B] }),
        request,
        [candidate('Kombi')],
        { createId: counterIds() },
      )
      expect(titles(next.ideas)).toEqual([
        'Kombi',
        'Weitere 0',
        'Weitere 1',
        'Playlist-Tagebuch',
        'Rezept-Mixer',
      ])
    })

    it('lehnt eine kombinierte Idee mit dem Titel einer anderen Karte ab', () => {
      const third = { ...IDEA_B, id: 'idea-c', title: 'Gießplan' }
      const session = makeSession({ ideas: [IDEA_A, IDEA_B, third] })
      expect(applyIdeas(session, request, [candidate('gießplan')])).toBe(session)
    })
  })

  it('lässt Profil und sonstige Felder der Sitzung unberührt', () => {
    const session = makeSession()
    const next = applyIdeas(session, { kind: 'generate' }, four(), { createId: counterIds() })
    expect(next.profile).toBe(session.profile)
  })
})

// ---------------------------------------------------------------------------
// ideaToClassification
// ---------------------------------------------------------------------------

describe('ideaToClassification', () => {
  it('überträgt Titel, Kurzbeschreibung und die Abschnitte als vage Vorschläge', () => {
    const classification = ideaToClassification(IDEA_A)

    expect(classification.projectName).toBe('Playlist-Tagebuch')
    expect(classification.summary).toBe(IDEA_A.pitch)
    expect(classification.sections).toEqual([
      {
        id: 'problem',
        content:
          'Notiert, welche Songs man wann gehört hat.\n\nMan vergisst, was man schon gehört hat.',
        maturity: 'vague',
      },
      { id: 'audience', content: 'Musikliebhaber', maturity: 'vague' },
      { id: 'features', content: '- Songs notieren\n- Monatsrückblick', maturity: 'vague' },
      { id: 'techStack', content: 'Web-App', maturity: 'vague' },
    ])
  })

  it('lässt leere Abschnitte weg', () => {
    const classification = ideaToClassification({
      ...IDEA_B,
      problem: '  ',
      audience: '',
      features: [],
      platform: '',
    })
    expect(classification.sections).toEqual([
      { id: 'problem', content: IDEA_B.pitch, maturity: 'vague' },
    ])
  })
})

// ---------------------------------------------------------------------------
// applyChosenIdea
// ---------------------------------------------------------------------------

/** Projekt mit einem Abschnitt, den die Person selbst geschrieben hat. */
function projectWithUserProblem(): Project {
  const base = makeProject({ name: 'Testprojekt' })
  return {
    ...base,
    blueprint: {
      sections: {
        ...base.blueprint.sections,
        problem: {
          id: 'problem',
          content: 'Mein eigener Text',
          maturity: 'decided',
          source: 'user',
        },
      },
    },
  }
}

describe('applyChosenIdea', () => {
  it('übernimmt Titel als Projektnamen und setzt den Einstieg „keine Idee“', () => {
    const result = applyChosenIdea(makeProject({ name: 'Testprojekt' }), IDEA_A)
    expect(result.name).toBe('Playlist-Tagebuch')
    expect(result.entryPoint).toBe('noIdea')
  })

  it('markiert die übernommenen Abschnitte als bestätigten KI-Inhalt', () => {
    const result = applyChosenIdea(makeProject(), IDEA_A)
    const { problem, audience, features, techStack } = result.blueprint.sections

    expect(problem.source).toBe('aiAccepted')
    expect(problem.content).toContain(IDEA_A.pitch)
    expect(problem.maturity).toBe('vague')
    expect(audience.source).toBe('aiAccepted')
    expect(features.content).toBe('- Songs notieren\n- Monatsrückblick')
    expect(techStack.source).toBe('aiAccepted')
  })

  it('lässt nicht betroffene Abschnitte leer und beim Nutzer', () => {
    const result = applyChosenIdea(makeProject(), IDEA_A)
    expect(result.blueprint.sections.nonGoals).toMatchObject({
      content: '',
      source: 'user',
      maturity: 'empty',
    })
  })

  it('lässt eigenen Nutzerinhalt unangetastet', () => {
    const result = applyChosenIdea(projectWithUserProblem(), IDEA_A)
    expect(result.blueprint.sections.problem).toMatchObject({
      content: 'Mein eigener Text',
      source: 'user',
      maturity: 'decided',
    })
    expect(result.blueprint.sections.audience.source).toBe('aiAccepted')
  })

  it('behält den Namen, wenn useSuggestedName false ist', () => {
    const result = applyChosenIdea(makeProject({ name: 'Eigener Name' }), IDEA_A, {
      useSuggestedName: false,
    })
    expect(result.name).toBe('Eigener Name')
  })

  it('behält den Namen, wenn der Titel zu lang für einen Projektnamen ist', () => {
    const longIdea = { ...IDEA_A, title: 'x'.repeat(130) }
    const result = applyChosenIdea(makeProject({ name: 'Testprojekt' }), longIdea)
    expect(result.name).toBe('Testprojekt')
  })

  it('ergibt ein Projekt, das projectSchema besteht', () => {
    const result = applyChosenIdea(projectWithUserProblem(), IDEA_B)
    expect(() => projectSchema.parse(result)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// generateIdeas (mit MockAiProvider, ohne Netzwerk)
// ---------------------------------------------------------------------------

describe('generateIdeas', () => {
  it('liefert die Kandidaten, Prompt-ID, Version und einen Aufruf', async () => {
    const provider = new MockAiProvider([ideasJson(candidate('Eins'), candidate('Zwei'))])

    const result = await generateIdeas({
      provider,
      profile: FULL_PROFILE,
      request: { kind: 'generate' },
      avoidTitles: [],
      language: 'de',
    })

    expect(titles(result.candidates)).toEqual(['Eins', 'Zwei'])
    expect(result.promptId).toBe('generate-ideas')
    expect(result.promptVersion).toBe(1)
    expect(result.calls).toHaveLength(1)
  })

  it('schickt ein JSON-Schema mit dem Namen project_ideas', async () => {
    const provider = new MockAiProvider([ideasJson(candidate('Eins'))])

    await generateIdeas({
      provider,
      profile: FULL_PROFILE,
      request: { kind: 'generate' },
      avoidTitles: [],
      language: 'de',
    })

    const [request] = provider.requests
    expect(request?.jsonSchema?.name).toBe('project_ideas')
    expect(request?.jsonSchema?.schema).toEqual(expect.objectContaining({ type: 'object' }))
  })

  it('schickt Systemnachricht und Nutzernachricht mit dem Fragebogen', async () => {
    const provider = new MockAiProvider([ideasJson(candidate('Eins'))])

    await generateIdeas({
      provider,
      profile: FULL_PROFILE,
      request: { kind: 'generate' },
      avoidTitles: ['Alt'],
      language: 'en',
    })

    const messages = provider.requests[0]?.messages ?? []
    expect(messages.map((m) => m.role)).toEqual(['system', 'user'])
    expect(messages[0]?.content).toContain('auf Englisch')
    expect(messages[1]?.content).toContain('- Interessen: Musik')
    expect(messages[1]?.content).toContain('- Alt')
  })

  it('bereinigt den Fragebogen vor dem Versand (Dubletten, Leerraum, Kürzung)', async () => {
    const provider = new MockAiProvider([ideasJson(candidate('Eins'))])

    await generateIdeas({
      provider,
      profile: {
        ...FULL_PROFILE,
        interests: [' Musik ', 'musik', 'Kochen'],
        learningGoal: '   Audio   ',
      },
      request: { kind: 'generate' },
      avoidTitles: [],
      language: 'de',
    })

    const user = provider.requests[0]?.messages[1]?.content ?? ''
    expect(user).toContain('- Interessen: Musik, Kochen')
    expect(user).toContain('- Lernziel: Audio')
  })

  it('verwendet die Standardtemperatur 0.9, sofern nichts anderes angegeben ist', async () => {
    const provider = new MockAiProvider([
      ideasJson(candidate('Eins')),
      ideasJson(candidate('Zwei')),
    ])

    await generateIdeas({
      provider,
      profile: FULL_PROFILE,
      request: { kind: 'generate' },
      avoidTitles: [],
      language: 'de',
    })
    await generateIdeas({
      provider,
      profile: FULL_PROFILE,
      request: { kind: 'generate' },
      avoidTitles: [],
      language: 'de',
      temperature: 0.3,
    })

    expect(provider.requests[0]?.temperature).toBe(0.9)
    expect(provider.requests[1]?.temperature).toBe(0.3)
  })

  it('wiederholt die Anfrage einmal bei ungültiger Antwort und liefert dann das Ergebnis', async () => {
    const provider = new MockAiProvider(['das ist kein JSON', ideasJson(candidate('Eins'))])

    const result = await generateIdeas({
      provider,
      profile: FULL_PROFILE,
      request: { kind: 'generate' },
      avoidTitles: [],
      language: 'de',
    })

    expect(result.calls).toHaveLength(2)
    expect(titles(result.candidates)).toEqual(['Eins'])
    expect(provider.requests[1]?.messages.at(-1)?.content).toContain(
      'passt nicht zum geforderten JSON-Schema',
    )
  })

  it('wirft einen AiError mit Code invalidResponse, wenn auch die Wiederholung ungültig ist', async () => {
    const provider = new MockAiProvider(['kein JSON', '{"ideas": "falsch"}'])

    const error = await generateIdeas({
      provider,
      profile: FULL_PROFILE,
      request: { kind: 'generate' },
      avoidTitles: [],
      language: 'de',
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AiError)
    expect((error as AiError).code).toBe('invalidResponse')
  })

  it('reicht Anbieterfehler unverändert weiter', async () => {
    const provider = new MockAiProvider([new AiError('rateLimited', 'Zu viele Anfragen')])

    await expect(
      generateIdeas({
        provider,
        profile: FULL_PROFILE,
        request: { kind: 'generate' },
        avoidTitles: [],
        language: 'de',
      }),
    ).rejects.toMatchObject({ code: 'rateLimited' })
  })
})

describe('ideaToDraft', () => {
  it('übernimmt Titel und Ideenfelder; Monetarisierung und Risiken bleiben leer', () => {
    expect(ideaToDraft(IDEA_A)).toEqual({
      name: IDEA_A.title,
      profile: {
        pitch: IDEA_A.pitch,
        problem: IDEA_A.problem,
        audience: IDEA_A.audience,
        features: IDEA_A.features,
        platform: IDEA_A.platform,
        monetization: { model: '', priceRange: '', reason: '' },
        effort: IDEA_A.effort,
        risks: [],
      },
    })
  })

  it('ergibt einen gültigen Steckbrief', () => {
    expect(profileSchema.safeParse(ideaToDraft(IDEA_B).profile).success).toBe(true)
  })
})
