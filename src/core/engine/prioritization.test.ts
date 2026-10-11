import type { Maturity, Project, Question } from '@/core/blueprint/schema'
import { SECTION_IDS, type SectionId } from '@/core/blueprint/sections'
import { makeProject, withMaturity } from '@/core/blueprint/testing'
import {
  blockReason,
  DEFAULT_ROUND_SIZE,
  MAX_ROUND_SIZE,
  prioritizeQuestions,
  scoreQuestion,
  selectRound,
} from './prioritization'

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

/** Alle Abschnitte entschieden: keine Abschnittsblockade und kein offenes Fundament. */
const ALL_DECIDED = Object.fromEntries(SECTION_IDS.map((id) => [id, 'decided'])) as Record<
  SectionId,
  Maturity
>

const CREATED = '2026-01-01T00:00:00.000Z'
const ANSWERED: Partial<Question> = {
  status: 'answered',
  answer: { kind: 'text', text: 'Antwort' },
  answeredAt: '2026-01-02T00:00:00.000Z',
}

function question(id: string, sectionId: SectionId, overrides: Partial<Question> = {}): Question {
  return {
    id,
    sectionId,
    text: `Frage ${id}`,
    why: '',
    leverage: 3,
    options: [],
    dependsOn: [],
    status: 'open',
    answer: null,
    createdAt: CREATED,
    answeredAt: null,
    ...overrides,
  }
}

/** Projekt mit den gegebenen Fragen; alle Abschnitte sind entschieden, außer `maturities` sagt etwas anderes. */
function projectWith(
  questions: Question[],
  maturities: Partial<Record<SectionId, Maturity>> = {},
): Project {
  const base = withMaturity(makeProject(), { ...ALL_DECIDED, ...maturities })
  return { ...base, interview: { ...base.interview, questions } }
}

const readyIds = (project: Project) => prioritizeQuestions(project).ready.map((r) => r.question.id)

// ---------------------------------------------------------------------------
// Score-Formel
// ---------------------------------------------------------------------------

describe('scoreQuestion', () => {
  it.each([
    ['empty', 9],
    ['vague', 6],
    ['decided', 3],
  ] as const)('Hebel 3 bei Reifegrad „%s“ ergibt %i', (maturity, expected) => {
    expect(scoreQuestion(question('a', 'techStack', { leverage: 3 }), maturity, 0)).toBe(expected)
  })

  it.each([
    [0, 2],
    [1, 3],
    [2, 4],
    [4, 6],
  ])('Hebel 2 mit %i abhängigen offenen Fragen ergibt %f', (dependents, expected) => {
    expect(scoreQuestion(question('a', 'techStack', { leverage: 2 }), 'decided', dependents)).toBe(
      expected,
    )
  })

  it('kombiniert Hebel, Unsicherheit und Abhängigkeitsbonus multiplikativ', () => {
    expect(scoreQuestion(question('a', 'techStack', { leverage: 5 }), 'empty', 2)).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// Reihenfolge der stellbaren Fragen
// ---------------------------------------------------------------------------

describe('prioritizeQuestions – Reihenfolge', () => {
  it.each([
    {
      name: 'Hebel × Unsicherheit: leerer Abschnitt mit Hebel 2 (6) vor entschiedenem mit Hebel 4 (4)',
      questions: [
        question('a', 'integrations', { leverage: 4 }),
        question('b', 'techStack', { leverage: 2 }),
      ],
      maturities: { techStack: 'empty' as const },
      expected: ['b', 'a'],
    },
    {
      name: 'leerer Abschnitt mit Hebel 3 (9) vor vagem mit Hebel 4 (8)',
      questions: [
        question('a', 'integrations', { leverage: 4 }),
        question('b', 'techStack', { leverage: 3 }),
      ],
      maturities: { integrations: 'vague' as const, techStack: 'empty' as const },
      expected: ['b', 'a'],
    },
    {
      name: 'gleicher Score (2): höherer Hebel gewinnt',
      questions: [
        question('a', 'risks', { leverage: 1 }),
        question('b', 'integrations', { leverage: 2 }),
      ],
      maturities: { risks: 'vague' as const },
      expected: ['b', 'a'],
    },
    {
      name: 'gleicher Score und Hebel: Abschnittsreihenfolge (techStack vor integrations)',
      questions: [
        question('a', 'integrations', { leverage: 3 }),
        question('b', 'techStack', { leverage: 3 }),
      ],
      maturities: {},
      expected: ['b', 'a'],
    },
    {
      name: 'gleicher Score, Hebel und Abschnitt: früher erstellt zuerst',
      questions: [
        question('a', 'techStack', { createdAt: '2026-02-01T00:00:00.000Z' }),
        question('b', 'techStack', { createdAt: '2026-01-01T00:00:00.000Z' }),
      ],
      maturities: {},
      expected: ['b', 'a'],
    },
    {
      name: 'alles gleich: ID aufsteigend, unabhängig von der Eingabereihenfolge',
      questions: [question('frage-b', 'techStack'), question('frage-a', 'techStack')],
      maturities: {},
      expected: ['frage-a', 'frage-b'],
    },
    {
      name: 'Abhängigkeitsbonus: Frage mit zwei offenen Abhängigen (4) vor Hebel 3 (3)',
      questions: [
        question('a', 'techStack', { leverage: 2 }),
        question('b', 'integrations', { leverage: 3 }),
        question('d1', 'techStack', { leverage: 1, dependsOn: ['a'] }),
        question('d2', 'techStack', { leverage: 1, dependsOn: ['a'] }),
      ],
      maturities: {},
      expected: ['a', 'b'],
    },
    {
      name: 'zurückgestellter Abhängiger zählt für den Bonus (3 × 1,5 = 4,5 vor 4)',
      questions: [
        question('a', 'integrations', { leverage: 3 }),
        question('b', 'techStack', { leverage: 4 }),
        question('d', 'techStack', { leverage: 1, dependsOn: ['a'], status: 'deferred' }),
      ],
      maturities: {},
      expected: ['a', 'b'],
    },
    {
      name: 'beantworteter Abhängiger zählt nicht mehr (3 bleibt unter 4)',
      questions: [
        question('a', 'integrations', { leverage: 3 }),
        question('b', 'techStack', { leverage: 4 }),
        question('d', 'techStack', { leverage: 1, dependsOn: ['a'], ...ANSWERED }),
      ],
      maturities: {},
      expected: ['b', 'a'],
    },
  ])('$name', ({ questions, maturities, expected }) => {
    expect(readyIds(projectWith(questions, maturities))).toEqual(expected)
  })

  it('liefert den Score und den Hebel der Frage mit', () => {
    const [first] = prioritizeQuestions(
      projectWith([question('a', 'techStack', { leverage: 4 })], { techStack: 'vague' }),
    ).ready

    expect(first?.score).toBe(8)
    expect(first?.question.id).toBe('a')
  })
})

// ---------------------------------------------------------------------------
// Blockaden
// ---------------------------------------------------------------------------

describe('blockReason – Abhängigkeit (dependency)', () => {
  const dependencyCases = [
    {
      name: 'offene Abhängigkeit blockiert',
      dependency: question('a', 'techStack'),
      blocked: true,
    },
    {
      name: 'zurückgestellte Abhängigkeit blockiert',
      dependency: question('a', 'techStack', { status: 'deferred' }),
      blocked: true,
    },
    {
      name: 'beantwortete Abhängigkeit blockiert nicht',
      dependency: question('a', 'techStack', ANSWERED),
      blocked: false,
    },
    {
      name: 'überholte Abhängigkeit blockiert nicht',
      dependency: question('a', 'techStack', { status: 'dismissed' }),
      blocked: false,
    },
    { name: 'unbekannte ID blockiert nicht', dependency: null, blocked: false },
  ]

  it.each(dependencyCases)('$name', ({ dependency, blocked }) => {
    const dependent = question('b', 'techStack', {
      dependsOn: dependency ? ['a'] : ['gespenst'],
    })
    const project = projectWith(dependency ? [dependency, dependent] : [dependent])
    const result = prioritizeQuestions(project)

    if (blocked) {
      expect(result.blocked.map((r) => r.question.id)).toContain('b')
      expect(result.blocked.find((r) => r.question.id === 'b')?.reason).toEqual({
        kind: 'dependency',
        questionIds: ['a'],
      })
    } else {
      expect(result.ready.map((r) => r.question.id)).toContain('b')
    }
  })

  it('nennt nur die offenen Abhängigkeiten', () => {
    const project = projectWith([
      question('a', 'techStack'),
      question('c', 'techStack', ANSWERED),
      question('b', 'techStack', { dependsOn: ['a', 'c'] }),
    ])
    const dependent = project.interview.questions.find((q) => q.id === 'b')

    expect(dependent && blockReason(dependent, project)).toEqual({
      kind: 'dependency',
      questionIds: ['a'],
    })
  })
})

describe('blockReason – Abschnitt (section)', () => {
  const sectionCases: {
    section: SectionId
    prerequisite: SectionId
    maturity: Maturity
    expected: SectionId[] | null
  }[] = [
    { section: 'features', prerequisite: 'problem', maturity: 'empty', expected: ['problem'] },
    { section: 'features', prerequisite: 'problem', maturity: 'vague', expected: null },
    { section: 'nonGoals', prerequisite: 'features', maturity: 'empty', expected: ['features'] },
    { section: 'flows', prerequisite: 'features', maturity: 'empty', expected: ['features'] },
    { section: 'dataModel', prerequisite: 'features', maturity: 'empty', expected: ['features'] },
    {
      section: 'integrations',
      prerequisite: 'features',
      maturity: 'empty',
      expected: ['features'],
    },
    { section: 'roadmap', prerequisite: 'features', maturity: 'empty', expected: ['features'] },
    { section: 'techStack', prerequisite: 'features', maturity: 'empty', expected: null },
    { section: 'risks', prerequisite: 'features', maturity: 'empty', expected: null },
  ]

  it.each(sectionCases)(
    'Abschnitt $section mit leerer Voraussetzung $prerequisite (Reife $maturity) → $expected',
    ({ section, prerequisite, maturity, expected }) => {
      // Hebel 5: die Grundsatzsperre (Fundament) greift hier nicht.
      const project = projectWith([question('x', section, { leverage: 5 })], {
        [prerequisite]: maturity,
      })
      const [x] = project.interview.questions
      const reason = x ? blockReason(x, project) : null

      if (expected) expect(reason).toEqual({ kind: 'section', sectionIds: expected })
      else expect(reason).toBeNull()
    },
  )
})

describe('blockReason – Fundament (foundation)', () => {
  const foundationCases = [
    {
      name: 'Detailfrage (Hebel 2) in techStack, Problem leer',
      section: 'techStack' as const,
      leverage: 2,
      empty: ['problem'] as SectionId[],
      expected: ['problem'],
    },
    {
      name: 'Detailfrage (Hebel 1) in techStack, Zielgruppe und MVP leer',
      section: 'techStack' as const,
      leverage: 1,
      empty: ['audience', 'features'] as SectionId[],
      expected: ['audience', 'features'],
    },
    {
      name: 'Hebel 3 gilt nicht als Detail',
      section: 'techStack' as const,
      leverage: 3,
      empty: ['problem'] as SectionId[],
      expected: null,
    },
    {
      name: 'Detail in einem Grundsatzabschnitt (audience) ist ausgenommen',
      section: 'audience' as const,
      leverage: 2,
      empty: ['features'] as SectionId[],
      expected: null,
    },
    {
      name: 'Detail in problem ist ausgenommen',
      section: 'problem' as const,
      leverage: 2,
      empty: ['audience'] as SectionId[],
      expected: null,
    },
    {
      name: 'Detail wird frei, sobald alle Grundsatzabschnitte gefüllt sind',
      section: 'integrations' as const,
      leverage: 2,
      empty: [] as SectionId[],
      expected: null,
    },
  ]

  it.each(foundationCases)('$name', ({ section, leverage, empty, expected }) => {
    const maturities = Object.fromEntries(empty.map((id) => [id, 'empty'])) as Partial<
      Record<SectionId, Maturity>
    >
    const project = projectWith([question('x', section, { leverage })], maturities)
    const [x] = project.interview.questions
    const reason = x ? blockReason(x, project) : null

    if (expected) expect(reason).toEqual({ kind: 'foundation', sectionIds: expected })
    else expect(reason).toBeNull()
  })

  it('Abschnittsblockade hat Vorrang vor dem Fundament', () => {
    // nonGoals braucht features; Hebel 1 wäre zusätzlich eine Fundament-Blockade.
    const project = projectWith([question('x', 'nonGoals', { leverage: 1 })], {
      problem: 'empty',
      features: 'empty',
    })
    const [x] = project.interview.questions

    expect(x && blockReason(x, project)).toEqual({ kind: 'section', sectionIds: ['features'] })
  })

  it('Abhängigkeit hat Vorrang vor Abschnitts- und Fundamentsperre', () => {
    const project = projectWith(
      [question('a', 'techStack'), question('x', 'nonGoals', { leverage: 1, dependsOn: ['a'] })],
      { problem: 'empty', features: 'empty' },
    )
    const x = project.interview.questions.find((q) => q.id === 'x')

    expect(x && blockReason(x, project)?.kind).toBe('dependency')
  })
})

describe('prioritizeQuestions – Blockaden und zurückgestellte Fragen', () => {
  it('trennt stellbare, blockierte und zurückgestellte Fragen', () => {
    const project = projectWith([
      question('a', 'techStack'),
      question('b', 'techStack', { dependsOn: ['a'] }),
      question('d', 'integrations', { status: 'deferred' }),
      question('e', 'techStack', ANSWERED),
      question('f', 'techStack', { status: 'dismissed' }),
    ])
    const result = prioritizeQuestions(project)

    expect(result.ready.map((r) => r.question.id)).toEqual(['a'])
    expect(result.blocked.map((r) => r.question.id)).toEqual(['b'])
    expect(result.deferred.map((r) => r.question.id)).toEqual(['d'])
  })

  it('sortiert zurückgestellte Fragen nach Score', () => {
    const project = projectWith([
      question('d1', 'integrations', { leverage: 2, status: 'deferred' }),
      question('d2', 'techStack', { leverage: 4, status: 'deferred' }),
    ])

    expect(prioritizeQuestions(project).deferred.map((r) => r.question.id)).toEqual(['d2', 'd1'])
  })

  it('listet zurückgestellte Fragen auch dann, wenn sie selbst blockiert wären', () => {
    const project = projectWith([
      question('a', 'techStack'),
      question('d', 'techStack', { dependsOn: ['a'], status: 'deferred' }),
    ])

    expect(prioritizeQuestions(project).deferred.map((r) => r.question.id)).toEqual(['d'])
  })

  it('liefert leere Listen für ein Projekt ohne Fragen', () => {
    expect(prioritizeQuestions(projectWith([]))).toEqual({ ready: [], blocked: [], deferred: [] })
  })
})

// ---------------------------------------------------------------------------
// Rundenauswahl
// ---------------------------------------------------------------------------

describe('selectRound', () => {
  const fiveReady = () =>
    projectWith(
      [1, 2, 3, 4, 5].map((leverage) => question(`r${leverage}`, 'techStack', { leverage })),
    )

  it('nutzt die Standardgröße, wenn keine Größe angegeben ist', () => {
    expect(DEFAULT_ROUND_SIZE).toBe(MAX_ROUND_SIZE)
    expect(selectRound(fiveReady())).toHaveLength(5)
  })

  it.each([
    [1, 1],
    [0, 1],
    [-5, 1],
    [2.7, 2],
    [3, 3],
    [10, 5],
  ])('Größe %s ergibt %i Fragen', (size, expected) => {
    expect(selectRound(fiveReady(), size)).toHaveLength(expected)
  })

  it('liefert die besten Fragen zuerst', () => {
    expect(selectRound(fiveReady(), 3).map((q) => q.id)).toEqual(['r5', 'r4', 'r3'])
  })

  it('liefert ein leeres Ergebnis ohne Fragen', () => {
    expect(selectRound(projectWith([]))).toEqual([])
  })

  it('greift auf zurückgestellte Fragen zurück, wenn nichts stellbar ist', () => {
    const project = projectWith([
      question('d1', 'integrations', { leverage: 2, status: 'deferred' }),
      question('d2', 'techStack', { leverage: 4, status: 'deferred' }),
    ])

    expect(selectRound(project).map((q) => q.id)).toEqual(['d2', 'd1'])
  })

  it('mischt nicht: stellbare Fragen gehen vor zurückgestellten', () => {
    const project = projectWith([
      question('a', 'techStack', { leverage: 1 }),
      question('d', 'techStack', { leverage: 5, status: 'deferred' }),
    ])

    expect(selectRound(project).map((q) => q.id)).toEqual(['a'])
  })

  it('nimmt eine zurückgestellte Frage mit offener Abhängigkeit nicht auf', () => {
    // a ist durch den Abschnitt „flows“ blockiert (features leer), d wartet auf a.
    const project = projectWith(
      [
        question('a', 'flows', { leverage: 3 }),
        question('d', 'techStack', { leverage: 5, dependsOn: ['a'], status: 'deferred' }),
      ],
      { features: 'empty' },
    )

    expect(selectRound(project).map((q) => q.id)).toEqual(['a'])
  })

  it('greift auf abschnitts- und fundamentblockierte Fragen zurück', () => {
    const project = projectWith(
      [question('s', 'flows', { leverage: 3 }), question('f', 'techStack', { leverage: 1 })],
      { features: 'empty', problem: 'empty' },
    )

    expect(
      selectRound(project)
        .map((q) => q.id)
        .sort(),
    ).toEqual(['f', 's'])
  })

  it('liefert nie eine abhängigkeitsblockierte Frage, auch wenn sie sonst die beste wäre', () => {
    // c ist durch Abschnitt flows blockiert, b (Hebel 5) wartet auf c.
    const project = projectWith(
      [
        question('c', 'flows', { leverage: 1 }),
        question('b', 'techStack', { leverage: 5, dependsOn: ['c'] }),
      ],
      { features: 'empty' },
    )

    expect(selectRound(project).map((q) => q.id)).toEqual(['c'])
  })

  it('liefert nichts, wenn alle Fragen zirkulär voneinander abhängen', () => {
    const project = projectWith([
      question('a', 'techStack', { dependsOn: ['b'] }),
      question('b', 'techStack', { dependsOn: ['a'] }),
    ])

    expect(selectRound(project)).toEqual([])
  })
})
