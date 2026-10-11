import { AiError } from '@/core/ai/errors'
import { MockAiProvider } from '@/core/ai/mockProvider'
import {
  IDENTIFY_DECISIONS_PROMPT_ID,
  IDENTIFY_DECISIONS_PROMPT_VERSION,
  MAX_DECISION_OPTIONS,
  type DecisionCandidate,
  type DecisionsResult,
} from '@/core/ai/prompts'
import { projectSchema } from '@/core/blueprint/schema'
import type { Decision, DecisionOption, Maturity, Project } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import { makeProject, withMaturity } from '@/core/blueprint/testing'
import {
  applyDecisionCandidates,
  chosenOption,
  CORE_DECISION_LIMIT,
  MAX_DECISIONS_PER_RUN,
  decide,
  decisionScore,
  DecisionError,
  dismissDecision,
  identifyDecisions,
  MAX_PROS_CONS,
  rankDecisions,
  reopenDecision,
} from './decisions'

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-01T10:00:00.000Z')
const NOW_ISO = NOW.toISOString()
const LATER_ISO = '2026-03-05T10:00:00.000Z'
const CREATED = '2026-01-01T00:00:00.000Z'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Deterministische IDs: d1, d2, … */
const sequentialIds = () => {
  let n = 0
  return () => `d${++n}`
}

/** Gültiges Projekt; wirft, wenn das Ergebnis nicht dem Schema entspricht. */
const parsed = (project: Project): Project => projectSchema.parse(project)

/** Fehlertext einer Funktion, die einen `DecisionError` werfen muss. */
function decisionErrorOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    if (error instanceof DecisionError) return error.message
    throw error
  }
  throw new Error('Kein Fehler geworfen')
}

const option = (id: string, label: string): DecisionOption => ({
  id,
  label,
  pros: ['Vorteil'],
  cons: ['Nachteil'],
  consequence: `Folge: ${label}`,
})

/** Gespeicherte Entscheidung; Standard: offen, Hebel 3, Abschnitt techStack, Optionen Web/Nativ. */
function makeDecision(id: string, overrides: Partial<Decision> = {}): Decision {
  return {
    id,
    sectionId: 'techStack',
    title: `Frage ${id}?`,
    context: '',
    leverage: 3,
    options: [option(`${id}-a`, 'Web'), option(`${id}-b`, 'Nativ')],
    recommendedOptionId: null,
    chosenOptionId: null,
    rationale: '',
    status: 'open',
    createdAt: CREATED,
    decidedAt: null,
    ...overrides,
  }
}

const withDecisions = (decisions: Decision[], base: Project = makeProject()): Project => ({
  ...base,
  decisions,
})

const projectWith = (
  decisions: Decision[],
  maturities: Partial<Record<SectionId, Maturity>> = {},
) => withMaturity(withDecisions(decisions), maturities)

/** Option wie sie die KI liefert (noch ohne ID). */
const candOption = (
  label: string,
  overrides: Partial<DecisionCandidate['options'][number]> = {},
): DecisionCandidate['options'][number] => ({
  label,
  pros: ['Vorteil'],
  cons: ['Nachteil'],
  consequence: 'Folge',
  ...overrides,
})

/** Kandidat der KI; Standard: Web oder nativ?, Hebel 4, Empfehlung Web. */
function candidate(overrides: Partial<DecisionCandidate> = {}): DecisionCandidate {
  return {
    sectionId: 'techStack',
    title: 'Web oder nativ?',
    context: 'Bestimmt den Aufwand.',
    leverage: 4,
    options: [candOption('Web'), candOption('Nativ')],
    recommendedOption: 0,
    ...overrides,
  }
}

const resultOf = (...decisions: DecisionCandidate[]): DecisionsResult => ({ decisions })

/** Übernimmt Kandidaten und prüft das Ergebnis gegen das Schema. */
const apply = (
  project: Project,
  candidates: DecisionCandidate[],
  createId: () => string = sequentialIds(),
) => parsed(applyDecisionCandidates(project, resultOf(...candidates), { now: NOW, createId }))

// ---------------------------------------------------------------------------
// applyDecisionCandidates
// ---------------------------------------------------------------------------

describe('applyDecisionCandidates', () => {
  it('überholt bisher offene Entscheidungen (dismissed) und hängt die neuen offenen an', () => {
    const before = withDecisions([makeDecision('old', { title: 'Alte Frage?' })])

    const next = apply(before, [candidate({ title: 'Neue Frage?' })])

    expect(next.decisions.map((d) => [d.title, d.status])).toEqual([
      ['Alte Frage?', 'dismissed'],
      ['Neue Frage?', 'open'],
    ])
  })

  it('lässt entschiedene und verworfene Entscheidungen unverändert', () => {
    const decided = makeDecision('d-done', {
      status: 'decided',
      chosenOptionId: 'd-done-a',
      rationale: 'Passt zum Ziel.',
      decidedAt: CREATED,
    })
    const dismissed = makeDecision('d-gone', { status: 'dismissed' })

    const next = apply(withDecisions([decided, dismissed]), [candidate()])

    expect(next.decisions.slice(0, 2)).toEqual([decided, dismissed])
  })

  it('übernimmt keinen Titel erneut, der schon entschieden oder verworfen ist', () => {
    const project = withDecisions([
      makeDecision('d-done', {
        title: 'Web oder nativ?',
        status: 'decided',
        chosenOptionId: 'd-done-a',
        decidedAt: CREATED,
      }),
      makeDecision('d-gone', { title: 'Farbschema?', status: 'dismissed' }),
    ])

    const next = apply(project, [
      candidate({ title: 'Web oder nativ?' }),
      candidate({ title: '  WEB   oder nativ? ' }),
      candidate({ title: 'farbschema?' }),
      candidate({ title: 'Login?' }),
    ])

    expect(next.decisions.filter((d) => d.status === 'open').map((d) => d.title)).toEqual([
      'Login?',
    ])
  })

  it('übernimmt den Titel einer bisher offenen Entscheidung wieder (die alte wird verworfen)', () => {
    const project = withDecisions([makeDecision('old', { title: 'Web oder nativ?' })])

    const next = apply(project, [candidate({ title: 'Web oder nativ?' })])

    expect(next.decisions.map((d) => [d.id, d.status])).toEqual([
      ['old', 'dismissed'],
      ['d1', 'open'],
    ])
  })

  it('übernimmt doppelte Titel innerhalb der Antwort nur einmal', () => {
    const next = apply(withDecisions([]), [
      candidate({ title: 'Web oder nativ?' }),
      candidate({ title: 'WEB oder nativ?', leverage: 2 }),
    ])

    expect(next.decisions.map((d) => d.title)).toEqual(['Web oder nativ?'])
  })

  it('entfernt Kandidaten mit leerem Titel und trimmt den Rest', () => {
    const next = apply(withDecisions([]), [
      candidate({ title: '' }),
      candidate({ title: '   ' }),
      candidate({ title: ' Login? ' }),
    ])

    expect(next.decisions.map((d) => d.title)).toEqual(['Login?'])
  })

  it(`übernimmt höchstens ${MAX_DECISIONS_PER_RUN} Entscheidungen; leere Kandidaten zählen nicht`, () => {
    const many = Array.from({ length: MAX_DECISIONS_PER_RUN + 2 }, (_, i) =>
      candidate({ title: `Frage ${i + 1}?` }),
    )

    const next = apply(withDecisions([]), [candidate({ title: '' }), ...many])

    expect(next.decisions).toHaveLength(MAX_DECISIONS_PER_RUN)
    expect(next.decisions.at(-1)?.title).toBe(`Frage ${MAX_DECISIONS_PER_RUN}?`)
  })

  it('kürzt nach Hebel, nicht nach Position, und behält die Reihenfolge', () => {
    const many = Array.from({ length: MAX_DECISIONS_PER_RUN + 1 }, (_, i) =>
      candidate({ title: `Frage ${i + 1}?`, leverage: i === 0 ? 1 : 3 }),
    )

    const next = apply(withDecisions([]), many)

    expect(next.decisions.map((d) => d.title)).not.toContain('Frage 1?')
    expect(next.decisions[0]?.title).toBe('Frage 2?')
  })

  it.each([
    [0, 1],
    [1, 1],
    [4.4, 4],
    [4.5, 5],
    [9, 5],
    [-2, 1],
    [NaN, 3],
  ])('begrenzt den Hebel %s auf %s', (leverage, expected) => {
    const next = apply(withDecisions([]), [candidate({ leverage })])

    expect(next.decisions[0]?.leverage).toBe(expected)
  })

  it('setzt Startwerte: offen, ohne Wahl und Begründung, mit Zeitstempel', () => {
    const next = apply(withDecisions([]), [
      candidate({ title: '  Web oder nativ?  ', context: '  Wichtig.  ', sectionId: 'flows' }),
    ])

    expect(next.decisions[0]).toMatchObject({
      id: 'd1',
      sectionId: 'flows',
      title: 'Web oder nativ?',
      context: 'Wichtig.',
      status: 'open',
      chosenOptionId: null,
      rationale: '',
      createdAt: NOW_ISO,
      decidedAt: null,
    })
  })

  it('vergibt Option-IDs fortlaufend als `${id}-o1` … und begrenzt auf MAX_DECISION_OPTIONS', () => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F']

    const next = apply(withDecisions([]), [
      candidate({ options: labels.map((l) => candOption(l)), recommendedOption: null }),
    ])

    const options = next.decisions[0]?.options ?? []
    expect(options).toHaveLength(MAX_DECISION_OPTIONS)
    expect(options.map((o) => o.id)).toEqual(['d1-o1', 'd1-o2', 'd1-o3', 'd1-o4'])
    expect(options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('entfernt leere und doppelte Optionen (ohne Groß-/Kleinschreibung) und vergibt IDs ohne Lücken', () => {
    const next = apply(withDecisions([]), [
      candidate({
        options: [
          candOption(''),
          candOption('  Web  '),
          candOption('web'),
          candOption('   '),
          candOption('Hybrid'),
        ],
        recommendedOption: null,
      }),
    ])

    const options = next.decisions[0]?.options ?? []
    expect(options.map((o) => o.label)).toEqual(['Web', 'Hybrid'])
    expect(options.map((o) => o.id)).toEqual(['d1-o1', 'd1-o2'])
  })

  it(`bereinigt Vor- und Nachteile (leer/doppelt raus, höchstens ${MAX_PROS_CONS}) und trimmt die Folge`, () => {
    const next = apply(withDecisions([]), [
      candidate({
        options: [
          candOption('Web', {
            pros: ['schnell', ' Schnell ', '', 'günstig', 'einfach', 'vierter Punkt'],
            cons: ['Kein Store', 'kein store'],
            consequence: '  Browser-App.  ',
          }),
          candOption('Nativ'),
        ],
        recommendedOption: null,
      }),
    ])

    expect(next.decisions[0]?.options[0]).toMatchObject({
      pros: ['schnell', 'günstig', 'einfach'],
      cons: ['Kein Store'],
      consequence: 'Browser-App.',
    })
  })

  it.each([
    ['nur eine gültige Option', [candOption('Web')]],
    ['alle Optionen leer', [candOption(''), candOption('  ')]],
    ['nur doppelte Optionen', [candOption('Web'), candOption(' web ')]],
  ])('verwirft einen Kandidaten mit weniger als zwei Optionen: %s', (_label, options) => {
    const next = apply(withDecisions([]), [candidate({ options, recommendedOption: null })])

    expect(next.decisions).toEqual([])
  })

  it('blockiert den Titel eines verworfenen Kandidaten nicht für einen späteren Kandidaten', () => {
    const next = apply(withDecisions([]), [
      candidate({ title: 'Login?', options: [candOption('Ja')] }),
      candidate({ title: 'Login?' }),
    ])

    expect(next.decisions.map((d) => d.title)).toEqual(['Login?'])
  })

  it('zeigt die Empfehlung nach dem Bereinigen auf dieselbe Option wie vorher', () => {
    const next = apply(withDecisions([]), [
      candidate({
        options: [candOption(''), candOption('Web'), candOption('Nativ')],
        recommendedOption: 2,
      }),
    ])

    const decision = next.decisions[0]
    expect(decision?.recommendedOptionId).toBe('d1-o2')
    expect(decision?.options.find((o) => o.id === decision.recommendedOptionId)?.label).toBe(
      'Nativ',
    )
  })

  it.each([
    ['ohne Empfehlung', [candOption('Web'), candOption('Nativ')], null],
    ['Index außerhalb der Optionen', [candOption('Web'), candOption('Nativ')], 7],
    ['empfohlene Option ist leer', [candOption(''), candOption('Web'), candOption('Nativ')], 0],
    [
      'empfohlene Option wurde als Duplikat entfernt',
      [candOption('Web'), candOption('Nativ'), candOption('web')],
      2,
    ],
  ])('setzt die Empfehlung auf null: %s', (_label, options, recommendedOption) => {
    const next = apply(withDecisions([]), [candidate({ options, recommendedOption })])

    expect(next.decisions[0]?.recommendedOptionId).toBeNull()
  })

  it('verändert das übergebene Projekt nicht', () => {
    const project = withDecisions([makeDecision('old')])
    const snapshot = structuredClone(project)

    apply(project, [candidate()])

    expect(project).toEqual(snapshot)
  })

  it('vergibt ohne createId eine UUID', () => {
    const next = applyDecisionCandidates(withDecisions([]), resultOf(candidate()), { now: NOW })

    expect(next.decisions[0]?.id).toMatch(UUID)
  })
})

// ---------------------------------------------------------------------------
// Score und Rangfolge
// ---------------------------------------------------------------------------

describe('decisionScore', () => {
  // Unsicherheit je Reifegrad: leer 3, angedeutet 2, entschieden 1.
  it.each([
    [5, 'empty', 15],
    [4, 'vague', 8],
    [2, 'decided', 2],
    [1, 'vague', 2],
  ] as const)('Hebel %s bei Reife „%s“ ergibt Score %s', (leverage, maturity, expected) => {
    const project = projectWith([], { techStack: maturity })

    expect(decisionScore(makeDecision('d', { leverage }), project)).toBe(expected)
  })
})

describe('rankDecisions – Rangfolge', () => {
  const rankedIds = (decisions: Decision[], maturities: Partial<Record<SectionId, Maturity>>) =>
    rankDecisions(projectWith(decisions, maturities)).core.map((d) => d.id)

  it.each([
    {
      name: 'zuerst der höhere Score (Hebel × Unsicherheit)',
      a: makeDecision('a', { leverage: 2, sectionId: 'audience' }), // 2 × 3 = 6
      b: makeDecision('b', { leverage: 4, sectionId: 'techStack' }), // 4 × 1 = 4
      maturities: { techStack: 'decided' } as const,
      expected: ['a', 'b'],
    },
    {
      name: 'bei gleichem Score zuerst der höhere Hebel',
      a: makeDecision('a', { leverage: 2, sectionId: 'risks' }), // 2 × 2 = 4
      b: makeDecision('b', { leverage: 4, sectionId: 'techStack' }), // 4 × 1 = 4
      maturities: { risks: 'vague', techStack: 'decided' } as const,
      expected: ['b', 'a'],
    },
    {
      name: 'bei gleichem Score und Hebel die frühere Abschnittsreihenfolge',
      a: makeDecision('a', { leverage: 3, sectionId: 'risks' }), // 3 × 2 = 6
      b: makeDecision('b', { leverage: 3, sectionId: 'problem' }), // 3 × 2 = 6
      maturities: { risks: 'vague', problem: 'vague' } as const,
      expected: ['b', 'a'],
    },
    {
      name: 'bei gleichem Abschnitt das früher angelegte zuerst',
      a: makeDecision('a', { createdAt: '2026-02-01T00:00:00.000Z' }),
      b: makeDecision('b', { createdAt: '2026-01-15T00:00:00.000Z' }),
      maturities: {} as const,
      expected: ['b', 'a'],
    },
    {
      name: 'bei gleichem Alter die kleinere ID',
      a: makeDecision('b'),
      b: makeDecision('a'),
      maturities: {} as const,
      expected: ['a', 'b'],
    },
  ])('$name', ({ a, b, maturities, expected }) => {
    // Das Ergebnis darf nicht von der Eingabereihenfolge abhängen.
    expect(rankedIds([a, b], maturities)).toEqual(expected)
    expect(rankedIds([b, a], maturities)).toEqual(expected)
  })

  it('zählt nur offene Entscheidungen für core und more', () => {
    const ranking = rankDecisions(
      projectWith([
        makeDecision('open'),
        makeDecision('gone', { status: 'dismissed' }),
        makeDecision('done', {
          status: 'decided',
          chosenOptionId: 'done-a',
          decidedAt: CREATED,
        }),
      ]),
    )

    expect(ranking.core.map((d) => d.id)).toEqual(['open'])
    expect(ranking.more).toEqual([])
  })

  it.each([
    [0, 0, 0],
    [1, 1, 0],
    [6, 6, 0],
    [CORE_DECISION_LIMIT, CORE_DECISION_LIMIT, 0],
    [CORE_DECISION_LIMIT + 1, CORE_DECISION_LIMIT, 1],
    [CORE_DECISION_LIMIT + 2, CORE_DECISION_LIMIT, 2],
  ])('bei %s offenen Entscheidungen: core %s, more %s', (count, coreSize, moreSize) => {
    const decisions = Array.from({ length: count }, (_, i) => makeDecision(`d${i}`))

    const ranking = rankDecisions(projectWith(decisions))

    expect(ranking.core).toHaveLength(coreSize)
    expect(ranking.more).toHaveLength(moreSize)
  })

  it('hat als Standard-Grenze CORE_DECISION_LIMIT (7)', () => {
    expect(CORE_DECISION_LIMIT).toBe(7)
  })

  it.each([
    [2, 2, 3],
    [0, 0, 5],
    [-3, 0, 5],
    [2.7, 2, 3],
    [100, 5, 0],
  ])('limit %s: core %s, more %s', (limit, coreSize, moreSize) => {
    const decisions = ['a', 'b', 'c', 'd', 'e'].map((id) => makeDecision(id))

    const ranking = rankDecisions(projectWith(decisions), limit)

    expect(ranking.core).toHaveLength(coreSize)
    expect(ranking.more).toHaveLength(moreSize)
    expect([...ranking.core, ...ranking.more].map((d) => d.id)).toEqual(
      rankDecisions(projectWith(decisions)).core.map((d) => d.id),
    )
  })
})

describe('rankDecisions – Entscheidungsprotokoll', () => {
  it('nennt nur getroffene Entscheidungen, nach Zeitpunkt sortiert', () => {
    const ranking = rankDecisions(
      projectWith([
        makeDecision('late', {
          status: 'decided',
          chosenOptionId: 'late-a',
          decidedAt: LATER_ISO,
        }),
        makeDecision('early', {
          status: 'decided',
          chosenOptionId: 'early-a',
          decidedAt: NOW_ISO,
        }),
        makeDecision('gone', { status: 'dismissed' }),
      ]),
    )

    expect(ranking.log.map((d) => d.id)).toEqual(['early', 'late'])
  })

  it('sortiert gleiche Zeitpunkte nach ID', () => {
    const ranking = rankDecisions(
      projectWith([
        makeDecision('z', { status: 'decided', chosenOptionId: 'z-a', decidedAt: NOW_ISO }),
        makeDecision('a', { status: 'decided', chosenOptionId: 'a-a', decidedAt: NOW_ISO }),
      ]),
    )

    expect(ranking.log.map((d) => d.id)).toEqual(['a', 'z'])
  })

  it('behandelt einen fehlenden Zeitpunkt als ältesten (Datenstand ohne decidedAt)', () => {
    const ranking = rankDecisions(
      projectWith([
        makeDecision('dated', { status: 'decided', chosenOptionId: 'dated-a', decidedAt: NOW_ISO }),
        makeDecision('undated-b', {
          status: 'decided',
          chosenOptionId: 'undated-b-a',
          decidedAt: null,
        }),
        makeDecision('undated-a', {
          status: 'decided',
          chosenOptionId: 'undated-a-a',
          decidedAt: null,
        }),
      ]),
    )

    expect(ranking.log.map((d) => d.id)).toEqual(['undated-a', 'undated-b', 'dated'])
  })

  it('ist leer, wenn nichts getroffen wurde', () => {
    expect(rankDecisions(projectWith([makeDecision('open')])).log).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Entscheiden, Wiederöffnen, Verwerfen
// ---------------------------------------------------------------------------

describe('decide', () => {
  const base = withDecisions([makeDecision('d1')])

  it('trifft eine offene Entscheidung mit Option, getrimmter Begründung und Zeitpunkt', () => {
    const next = parsed(decide(base, 'd1', 'd1-b', '  Wir wollen überall laufen.  ', NOW))

    expect(next.decisions[0]).toMatchObject({
      status: 'decided',
      chosenOptionId: 'd1-b',
      rationale: 'Wir wollen überall laufen.',
      decidedAt: NOW_ISO,
    })
  })

  it('lässt die übrigen Felder der Entscheidung unverändert', () => {
    const before = base.decisions[0]
    const next = parsed(decide(base, 'd1', 'd1-a', 'Begründung', NOW))

    expect(next.decisions[0]).toEqual({
      ...before,
      status: 'decided',
      chosenOptionId: 'd1-a',
      rationale: 'Begründung',
      decidedAt: NOW_ISO,
    })
  })

  it('erlaubt, eine getroffene Entscheidung neu zu entscheiden', () => {
    const first = decide(base, 'd1', 'd1-a', 'Erste Wahl', NOW)
    const second = parsed(decide(first, 'd1', 'd1-b', 'Doch anders', new Date(LATER_ISO)))

    expect(second.decisions[0]).toMatchObject({
      status: 'decided',
      chosenOptionId: 'd1-b',
      rationale: 'Doch anders',
      decidedAt: LATER_ISO,
    })
  })

  it('lässt andere Entscheidungen unverändert', () => {
    const two = withDecisions([makeDecision('d1'), makeDecision('d2')])
    const other = two.decisions[1]

    expect(decide(two, 'd1', 'd1-a', '', NOW).decisions[1]).toEqual(other)
  })

  it('verändert das übergebene Projekt nicht', () => {
    const snapshot = structuredClone(base)

    decide(base, 'd1', 'd1-a', 'x', NOW)

    expect(base).toEqual(snapshot)
  })

  it('lehnt verworfene Entscheidungen ab', () => {
    const dismissed = withDecisions([makeDecision('d1', { status: 'dismissed' })])

    expect(decisionErrorOf(() => decide(dismissed, 'd1', 'd1-a', '', NOW))).toBe(
      'Entscheidung d1 ist verworfen',
    )
  })

  it('lehnt unbekannte Entscheidungen ab', () => {
    expect(decisionErrorOf(() => decide(base, 'x', 'd1-a', '', NOW))).toBe(
      'Unbekannte Entscheidung: x',
    )
  })

  it('lehnt unbekannte Optionen ab, auch Optionen anderer Entscheidungen', () => {
    const two = withDecisions([makeDecision('d1'), makeDecision('d2')])

    expect(decisionErrorOf(() => decide(two, 'd1', 'd1-z', '', NOW))).toBe(
      'Unbekannte Option: d1-z',
    )
    expect(decisionErrorOf(() => decide(two, 'd1', 'd2-a', '', NOW))).toBe(
      'Unbekannte Option: d2-a',
    )
  })
})

describe('reopenDecision', () => {
  it('öffnet eine getroffene Entscheidung wieder; die Begründung bleibt als Entwurf', () => {
    const decided = decide(withDecisions([makeDecision('d1')]), 'd1', 'd1-b', 'Entwurf', NOW)

    const next = parsed(reopenDecision(decided, 'd1'))

    expect(next.decisions[0]).toMatchObject({
      status: 'open',
      chosenOptionId: null,
      decidedAt: null,
      rationale: 'Entwurf',
    })
  })

  it('öffnet eine verworfene Entscheidung wieder', () => {
    const dismissed = withDecisions([makeDecision('d1', { status: 'dismissed' })])

    expect(parsed(reopenDecision(dismissed, 'd1')).decisions[0]?.status).toBe('open')
  })

  it('lässt eine offene Entscheidung unverändert (gleiches Projekt)', () => {
    const project = withDecisions([makeDecision('d1')])

    expect(reopenDecision(project, 'd1')).toBe(project)
  })

  it('macht eine wieder geöffnete Entscheidung erneut zur Kernentscheidung', () => {
    const decided = decide(withDecisions([makeDecision('d1')]), 'd1', 'd1-a', '', NOW)
    expect(rankDecisions(decided).core).toEqual([])

    const reopened = reopenDecision(decided, 'd1')

    expect(rankDecisions(reopened).core.map((d) => d.id)).toEqual(['d1'])
  })

  it('lehnt unbekannte Entscheidungen ab', () => {
    expect(decisionErrorOf(() => reopenDecision(withDecisions([]), 'x'))).toBe(
      'Unbekannte Entscheidung: x',
    )
  })
})

describe('dismissDecision', () => {
  it('verwirft eine offene Entscheidung; sie erscheint nicht mehr in der Rangfolge', () => {
    const next = parsed(dismissDecision(withDecisions([makeDecision('d1')]), 'd1'))

    expect(next.decisions[0]?.status).toBe('dismissed')
    expect(rankDecisions(next).core).toEqual([])
  })

  it.each([
    ['getroffene', 'decided'],
    ['verworfene', 'dismissed'],
  ] as const)('lehnt eine %s Entscheidung ab', (_label, status) => {
    const project = withDecisions([
      makeDecision('d1', {
        status,
        ...(status === 'decided' ? { chosenOptionId: 'd1-a', decidedAt: CREATED } : {}),
      }),
    ])

    expect(decisionErrorOf(() => dismissDecision(project, 'd1'))).toBe(
      `Entscheidung d1 ist nicht offen (${status})`,
    )
  })

  it('lehnt unbekannte Entscheidungen ab', () => {
    expect(decisionErrorOf(() => dismissDecision(withDecisions([]), 'x'))).toBe(
      'Unbekannte Entscheidung: x',
    )
  })
})

describe('chosenOption', () => {
  it('liefert die gewählte Option einer getroffenen Entscheidung', () => {
    const decided = decide(withDecisions([makeDecision('d1')]), 'd1', 'd1-b', '', NOW)

    expect(chosenOption(decided.decisions[0] as Decision)).toEqual(makeDecision('d1').options[1])
  })

  it('liefert null bei offenen Entscheidungen', () => {
    expect(chosenOption(makeDecision('d1'))).toBeNull()
  })

  it('liefert null, wenn die gewählte Option nicht (mehr) existiert', () => {
    expect(chosenOption(makeDecision('d1', { chosenOptionId: 'gone' }))).toBeNull()
  })
})

describe('DecisionError', () => {
  it('ist ein Error mit eigenem Namen', () => {
    const error = new DecisionError('Test')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('DecisionError')
  })
})

// ---------------------------------------------------------------------------
// KI-Ermittlung mit MockAiProvider
// ---------------------------------------------------------------------------

describe('identifyDecisions', () => {
  const project = makeProject({ name: 'Rezeptplaner' })
  const validJson = JSON.stringify(resultOf(candidate()))

  it('fragt mit dem Schema core_decisions an und liefert Ergebnis, Aufrufe und Prompt-Version', async () => {
    const provider = new MockAiProvider([validJson])

    const outcome = await identifyDecisions({ provider, project, language: 'de' })

    expect(provider.requests[0]?.jsonSchema?.name).toBe('core_decisions')
    expect(outcome.result.decisions).toHaveLength(1)
    expect(outcome.calls).toHaveLength(1)
    expect(outcome.promptId).toBe(IDENTIFY_DECISIONS_PROMPT_ID)
    expect(outcome.promptVersion).toBe(IDENTIFY_DECISIONS_PROMPT_VERSION)
  })

  it('verwendet standardmäßig Temperatur 0,3 und reicht eine eigene Temperatur durch', async () => {
    const provider = new MockAiProvider([validJson, validJson])

    await identifyDecisions({ provider, project, language: 'de' })
    await identifyDecisions({ provider, project, language: 'de', temperature: 0.8 })

    expect(provider.requests.map((r) => r.temperature)).toEqual([0.3, 0.8])
  })

  it('weist die Ausgabesprache im Prompt aus', async () => {
    const provider = new MockAiProvider([validJson, validJson])

    await identifyDecisions({ provider, project, language: 'de' })
    await identifyDecisions({ provider, project, language: 'en' })

    expect(provider.requests[0]?.messages[0]?.content).toContain('auf Deutsch')
    expect(provider.requests[1]?.messages[0]?.content).toContain('Englisch')
  })

  it('repariert eine ungültige Antwort mit einem zweiten Aufruf', async () => {
    const invalid = JSON.stringify(resultOf(candidate({ sectionId: 'backend' as never })))
    const provider = new MockAiProvider([invalid, validJson])

    const outcome = await identifyDecisions({ provider, project, language: 'de' })

    expect(outcome.calls).toHaveLength(2)
    expect(outcome.result.decisions[0]?.title).toBe('Web oder nativ?')
  })

  it('wirft invalidResponse, wenn auch der zweite Versuch ungültig ist', async () => {
    const provider = new MockAiProvider(['kein JSON', 'immer noch kein JSON'])

    const error = await identifyDecisions({ provider, project, language: 'de' }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(AiError)
    expect(error).toMatchObject({ code: 'invalidResponse' })
  })

  it('reicht das Abbruchsignal an den Anbieter weiter', async () => {
    const provider = new MockAiProvider([validJson])
    const controller = new AbortController()
    controller.abort()

    await expect(
      identifyDecisions({ provider, project, language: 'de', signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'aborted' })
  })
})
