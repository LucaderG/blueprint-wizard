import type { Decision, DecisionOption, Project } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import { makeProject } from '@/core/blueprint/testing'
import {
  CONTRADICTION_RULES,
  detectContradictions,
  FEATURE_IS_NON_GOAL,
  type ContradictionRule,
} from './contradictions'

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const CREATED = '2026-01-01T00:00:00.000Z'

/** Projekt mit den angegebenen Abschnittsinhalten (und optional Entscheidungen). */
function withContent(
  contents: Partial<Record<SectionId, string>>,
  decisions: Decision[] = [],
): Project {
  const base = makeProject()
  const sections = { ...base.blueprint.sections }
  for (const [id, content] of Object.entries(contents) as [SectionId, string][]) {
    sections[id] = { ...sections[id], content }
  }
  return { ...base, blueprint: { sections }, decisions }
}

const option = (id: string, label: string): DecisionOption => ({
  id,
  label,
  pros: [],
  cons: [],
  consequence: '',
})

/** Entscheidung mit zwei Optionen (Label „Echtzeit-Sync“ und „Lokal“), Standard: offen. */
function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'd1',
    sectionId: 'dataModel',
    title: 'Wie synchronisieren wir?',
    context: '',
    leverage: 4,
    options: [option('d1-a', 'Echtzeit-Sync'), option('d1-b', 'Lokal')],
    recommendedOptionId: null,
    chosenOptionId: null,
    rationale: '',
    status: 'open',
    createdAt: CREATED,
    decidedAt: null,
    ...overrides,
  }
}

const ruleIds = (project: Project) => detectContradictions(project).map((c) => c.ruleId)

/**
 * Beispielfälle je Regel: Fundstelle A und Fundstelle B stehen in unterschiedlichen Abschnitten.
 * Jeder Fall löst genau diese eine Regel aus.
 */
const POSITIVE: [string, SectionId, string, SectionId, string][] = [
  [
    'offlineVsRealtime',
    'problem',
    'Die App funktioniert offline auf dem Gerät.',
    'features',
    'Echtzeit-Synchronisation zwischen Geräten.',
  ],
  [
    'localOnlyVsAccounts',
    'problem',
    'Daten bleiben lokal auf dem Gerät.',
    'features',
    'Login mit E-Mail-Adresse.',
  ],
  ['freeVsPaid', 'problem', 'Die App ist kostenlos nutzbar.', 'roadmap', 'Premium-Abo für Teams.'],
  ['webOnlyVsNative', 'techStack', 'Nur im Browser nutzbar.', 'flows', 'Verfügbar im App Store.'],
  [
    'noAiVsAi',
    'problem',
    'Ohne KI, rein regelbasiert.',
    'features',
    'Die App nutzt ein LLM für Vorschläge.',
  ],
  [
    'privacyVsTracking',
    'problem',
    'Datensparsam: wir sammeln nur das Nötigste.',
    'flows',
    'Analytics-Skripte zur Nutzungsmessung.',
  ],
]

/**
 * Verneinte Fundstellen: auf Seite A oder B steht das Muster mit „ohne“, „keine“, „nicht“ …
 * Dann gibt es keine Warnung.
 */
const NEGATED: [string, string, SectionId, string, SectionId, string][] = [
  [
    'offlineVsRealtime',
    'Seite A verneint',
    'problem',
    'Ohne Offline-Betrieb, nur online.',
    'features',
    'Echtzeit-Synchronisation.',
  ],
  [
    'offlineVsRealtime',
    'Seite B verneint',
    'problem',
    'Die App funktioniert offline.',
    'features',
    'Keine Echtzeit-Synchronisation.',
  ],
  [
    'localOnlyVsAccounts',
    'Seite A verneint',
    'problem',
    'Nicht nur lokal, sondern in der Cloud.',
    'features',
    'Login mit E-Mail-Adresse.',
  ],
  [
    'localOnlyVsAccounts',
    'Seite B verneint',
    'problem',
    'Daten bleiben lokal auf dem Gerät.',
    'features',
    'Ohne Login.',
  ],
  [
    'freeVsPaid',
    'Seite A verneint',
    'problem',
    'Die App ist nicht kostenlos.',
    'roadmap',
    'Premium-Abo für Teams.',
  ],
  [
    'freeVsPaid',
    'Seite B verneint',
    'problem',
    'Die App ist kostenlos nutzbar.',
    'roadmap',
    'Keine Gebühren, kein Abo.',
  ],
  [
    'webOnlyVsNative',
    'Seite A verneint',
    'techStack',
    'Nicht nur im Browser.',
    'flows',
    'Verfügbar im App Store.',
  ],
  [
    'webOnlyVsNative',
    'Seite B verneint',
    'techStack',
    'Nur im Browser nutzbar.',
    'flows',
    'Keine native App geplant.',
  ],
  [
    'noAiVsAi',
    'Seite A verneint',
    'problem',
    'Nicht ohne KI geplant.',
    'features',
    'Die App nutzt ein LLM für Vorschläge.',
  ],
  [
    'noAiVsAi',
    'Seite B verneint',
    'problem',
    'Ohne KI, rein regelbasiert.',
    'features',
    'Keine KI-Funktionen.',
  ],
  [
    'privacyVsTracking',
    'Seite A verneint',
    'problem',
    'Nicht datensparsam, wir sammeln alles.',
    'flows',
    'Analytics-Skripte zur Nutzungsmessung.',
  ],
  [
    'privacyVsTracking',
    'Seite B verneint',
    'problem',
    'Datensparsam: wir sammeln nur das Nötigste.',
    'flows',
    'Keine Werbung.',
  ],
]

// ---------------------------------------------------------------------------
// Regeln mit Beispielfällen
// ---------------------------------------------------------------------------

describe('Widerspruchsregeln', () => {
  it('hat zu jeder Regel einen Beispielfall', () => {
    expect(POSITIVE.map(([id]) => id).sort()).toEqual(CONTRADICTION_RULES.map((r) => r.id).sort())
  })

  it.each(POSITIVE)(
    '%s: Fundstellen in zwei Abschnitten melden genau diesen Widerspruch',
    (ruleId, sa, ta, sb, tb) => {
      expect(detectContradictions(withContent({ [sa]: ta, [sb]: tb }))).toMatchObject([
        { ruleId, sectionIds: [sa, sb], evidence: [ta, tb] },
      ])
    },
  )

  it.each(NEGATED)(
    '%s (%s): verneinte Fundstelle löst keine Warnung aus',
    (_rule, _label, sa, ta, sb, tb) => {
      expect(ruleIds(withContent({ [sa]: ta, [sb]: tb }))).toEqual([])
    },
  )

  it.each(POSITIVE)('%s: nur eine Seite vorhanden, keine Warnung', (_ruleId, sa, ta, sb, tb) => {
    expect(ruleIds(withContent({ [sa]: ta }))).toEqual([])
    expect(ruleIds(withContent({ [sb]: tb }))).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Fundstellen, Entscheidungen und Warnungen
// ---------------------------------------------------------------------------

describe('detectContradictions', () => {
  it('kommt auch mit Mustern zurecht, die das Flag g tragen', () => {
    // Die Regeln tragen heute kein g-Flag; die Funktion soll es trotzdem verkraften.
    const rules = CONTRADICTION_RULES as ContradictionRule[]
    const rule: ContradictionRule = { id: 'globalFlag', a: [/zebra/g], b: [/einhorn/] }
    rules.push(rule)
    try {
      expect(
        detectContradictions(withContent({ problem: 'Zebra', features: 'Einhorn' })),
      ).toMatchObject([
        {
          ruleId: 'globalFlag',
          sectionIds: ['problem', 'features'],
          evidence: ['Zebra', 'Einhorn'],
        },
      ])
    } finally {
      rules.splice(rules.indexOf(rule), 1)
    }
  })

  it('liefert bei leerem Blueprint keine Widersprüche', () => {
    expect(detectContradictions(makeProject())).toEqual([])
  })

  it('findet beide Seiten in derselben Zeile', () => {
    const line = 'Offline-first mit Echtzeit-Sync.'

    expect(detectContradictions(withContent({ problem: line }))).toMatchObject([
      { ruleId: 'offlineVsRealtime', sectionIds: ['problem'], evidence: [line, line] },
    ])
  })

  it('zählt die gewählte Option einer getroffenen Entscheidung als Fundstelle', () => {
    const decided = makeDecision({
      status: 'decided',
      chosenOptionId: 'd1-a',
      decidedAt: CREATED,
    })

    expect(
      detectContradictions(withContent({ problem: 'Offline-first Betrieb.' }, [decided])),
    ).toMatchObject([
      {
        ruleId: 'offlineVsRealtime',
        sectionIds: ['problem', 'dataModel'],
        evidence: ['Offline-first Betrieb.', 'Echtzeit-Sync'],
      },
    ])
  })

  it.each([
    ['offene Entscheidung', makeDecision({ status: 'open' })],
    ['verworfene Entscheidung', makeDecision({ status: 'dismissed' })],
    [
      'getroffen, aber mit anderer Option',
      makeDecision({ status: 'decided', chosenOptionId: 'd1-b', decidedAt: CREATED }),
    ],
  ])('zählt eine %s nicht als Fundstelle', (_label, decision) => {
    expect(
      detectContradictions(withContent({ problem: 'Offline-first Betrieb.' }, [decision])),
    ).toEqual([])
  })

  it('meldet je Regel höchstens eine Warnung, auch bei mehreren Fundstellen', () => {
    const project = withContent({
      problem: 'Offline-Modus A\nOffline-Modus B',
      features: 'Echtzeit-Sync\nMultiplayer',
    })

    expect(detectContradictions(project)).toMatchObject([
      {
        ruleId: 'offlineVsRealtime',
        sectionIds: ['problem', 'features'],
        evidence: ['Offline-Modus A', 'Echtzeit-Sync'],
      },
    ])
  })

  it.each(['- ', '* ', '+ ', '1. ', '2) ', '   - '])(
    'zeigt die Zeile ohne Aufzählungszeichen (Präfix „%s“)',
    (prefix) => {
      const project = withContent({
        problem: `${prefix}Offline-Modus`,
        features: '* Echtzeit-Sync',
      })

      expect(detectContradictions(project)[0]?.evidence).toEqual(['Offline-Modus', 'Echtzeit-Sync'])
    },
  )

  it('kürzt lange Fundstellen auf 120 Zeichen mit „…“', () => {
    const long = `Offline ${'x'.repeat(300)}`
    const [found] = detectContradictions(withContent({ problem: long, features: 'Echtzeit' }))

    expect(found?.evidence[0]).toHaveLength(120)
    expect(found?.evidence[0]?.endsWith('…')).toBe(true)
    expect(found?.evidence[0]?.startsWith('Offline x')).toBe(true)
  })

  it('kürzt eine Fundstelle mit genau 120 Zeichen nicht', () => {
    const exact = `Offline ${'x'.repeat(112)}`
    expect(exact).toHaveLength(120)
    const [found] = detectContradictions(withContent({ problem: exact, features: 'Echtzeit' }))

    expect(found?.evidence[0]).toBe(exact)
  })

  it.each(['kein', 'keine', 'keinen', 'ohne', 'nicht', 'no', 'not', 'without'])(
    'erkennt das verneinende Wort „%s“ vor der Fundstelle',
    (word) => {
      expect(
        ruleIds(withContent({ problem: `${word} Offline`, features: 'Echtzeit-Sync' })),
      ).toEqual([])
    },
  )
})

// ---------------------------------------------------------------------------
// Feature zugleich Nicht-Ziel
// ---------------------------------------------------------------------------

describe('featureIsNonGoal', () => {
  it.each([
    [
      'gleicher Wortlaut',
      'Login per E-Mail',
      'Login per E-Mail',
      ['Login per E-Mail', 'Login per E-Mail'],
    ],
    [
      'andere Groß-/Kleinschreibung',
      'Login per E-Mail',
      'login per e-mail',
      ['Login per E-Mail', 'login per e-mail'],
    ],
    [
      'Aufzählungszeichen in Kernfunktionen und Nicht-Zielen',
      '- Login per E-Mail',
      '* LOGIN PER E-MAIL',
      ['Login per E-Mail', 'LOGIN PER E-MAIL'],
    ],
    [
      'Nummerierung und Leerraum',
      '2) Login per E-Mail',
      '  1. Login  per E-Mail ',
      ['Login per E-Mail', 'Login  per E-Mail'],
    ],
  ])('meldet denselben Punkt in beiden Abschnitten (%s)', (_label, feature, nonGoal, evidence) => {
    expect(
      detectContradictions(withContent({ features: feature, nonGoals: nonGoal })),
    ).toMatchObject([
      { ruleId: FEATURE_IS_NON_GOAL, sectionIds: ['features', 'nonGoals'], evidence },
    ])
  })

  it('meldet unterschiedliche Punkte nicht', () => {
    expect(detectContradictions(withContent({ features: 'Login', nonGoals: 'Werbung' }))).toEqual(
      [],
    )
  })

  it('meldet jeden gemeinsamen Punkt einzeln', () => {
    const project = withContent({
      features: 'Login\nWerbung',
      nonGoals: 'Werbung\nLogin',
    })

    expect(detectContradictions(project).map((c) => c.evidence[0])).toEqual(['Login', 'Werbung'])
  })
})

describe('detectContradictions – bekannte Falsch-Positive', () => {
  it.each<[string, Partial<Record<SectionId, string>>]>([
    ['Freemium', { roadmap: 'Kostenlos starten, danach Abo für Profis' }],
    ['Testphase', { roadmap: '- Kostenlos\n- Danach Abo nach der Testphase' }],
    ['Verneinung nach dem Wort', { techStack: 'Nur lokal. Login ist nicht erforderlich.' }],
    ['drei Wörter Abstand', { techStack: 'Nur lokal', features: 'Ohne den lästigen Login' }],
    ['entfällt', { techStack: 'Offline-Modus', features: 'Echtzeit-Anzeige entfällt' }],
    ['nicht nötig', { techStack: 'Offline-Modus wichtig. Echtzeit-Anzeige nicht nötig.' }],
    [
      'zeitliche Staffelung',
      { techStack: 'Phase 1 nur im Browser', roadmap: 'App-Store-Version in Phase 2' },
    ],
  ])('%s löst keine Warnung aus', (_label, contents) => {
    expect(detectContradictions(withContent(contents))).toEqual([])
  })

  it('bleibt bei echtem Widerspruch trotz Verneinung in einem anderen Satz', () => {
    const project = withContent({
      techStack: 'Nur lokal. Synchronisierung nicht nötig.',
      features: 'Login mit Google',
    })

    expect(detectContradictions(project).map((c) => c.ruleId)).toEqual(['localOnlyVsAccounts'])
  })

  it('ordnet jeder Fundstelle ihren Abschnitt zu', () => {
    const project = withContent({ techStack: 'Offline-first', features: 'Echtzeit-Sync' })

    expect(detectContradictions(project)[0]?.evidenceSectionIds).toEqual(['techStack', 'features'])
  })
})
