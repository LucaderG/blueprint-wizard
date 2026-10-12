import { MockAiProvider } from '@/core/ai/mockProvider'
import type { ModelCandidate, PricingCandidate } from '@/core/ai/prompts'
import { updateSection } from '@/core/blueprint/editing'
import {
  projectSchema,
  type Monetization,
  type MonetizationModel,
  type PricingOption,
  type Project,
} from '@/core/blueprint/schema'
import { makeProject, withMaturity } from '@/core/blueprint/testing'
import {
  addManualModel,
  addManualPricing,
  appendImpactNote,
  applyModelCandidates,
  applyPricingCandidates,
  canFinalize,
  chooseModels,
  choosePricing,
  combinationWarnings,
  emptyMonetization,
  finalizeMonetization,
  hasImpactNote,
  isValidCombination,
  MAX_MODEL_CONCERNS,
  MonetizationError,
  monetizationAvailability,
  monetizationImpacts,
  needsPricing,
  reopenMonetization,
  resetMonetization,
  suggestMonetizationModels,
  suggestPricingStrategies,
} from './monetization'

const NOW = new Date('2026-10-12T10:00:00.000Z')

function ids(prefix: string) {
  let n = 0
  return () => `${prefix}${++n}`
}

const scores = {
  revenuePotential: 4,
  implementationEase: 3,
  userAcceptance: 3,
  predictability: 5,
  audienceFit: 4,
  techFit: 3,
}

function candidate(overrides: Partial<ModelCandidate> = {}): ModelCandidate {
  return {
    kind: 'subscription',
    title: 'Abo',
    summary: 'Monatlich zahlen.',
    fitReason: 'Laufender Nutzen.',
    concerns: ['Abo-Müdigkeit'],
    scores,
    recommended: false,
    ...overrides,
  }
}

function pricingCandidate(overrides: Partial<PricingCandidate> = {}): PricingCandidate {
  return {
    strategy: 'tiers',
    title: 'Drei Pakete',
    summary: 'Basic, Pro, Team.',
    examplePrices: 'Pro: 4–8 € pro Monat',
    reason: 'Klar verständlich.',
    recommended: false,
    ...overrides,
  }
}

function model(id: string, overrides: Partial<MonetizationModel> = {}): MonetizationModel {
  return {
    id,
    kind: 'subscription',
    title: '',
    summary: 'Text',
    fitReason: '',
    concerns: [],
    scores: null,
    recommended: false,
    ...overrides,
  }
}

function pricing(id: string, overrides: Partial<PricingOption> = {}): PricingOption {
  return {
    id,
    strategy: 'tiers',
    title: '',
    summary: 'Text',
    examplePrices: '',
    reason: '',
    recommended: false,
    ...overrides,
  }
}

function withMonetization(overrides: Partial<Monetization> = {}): Project {
  return makeProject({ monetization: { ...emptyMonetization(), ...overrides } })
}

/** Projekt mit gewähltem Abo-Modell (m1) und zwei Preisoptionen (p1, p2). */
function withPaidModel(): Project {
  return withMonetization({
    models: [model('m1'), model('m2', { kind: 'ads' }), model('m3', { kind: 'none' })],
    chosenModelIds: ['m1'],
    pricingOptions: [pricing('p1'), pricing('p2', { strategy: 'penetration' })],
  })
}

const mon = (project: Project) => project.monetization!

describe('monetizationAvailability', () => {
  const filled = (project: Project) =>
    (['problem', 'audience', 'features'] as const).reduce(
      (p, id) => updateSection(p, id, { content: 'Inhalt' }),
      project,
    )

  it('ist bei leerem Blueprint nicht verfügbar und nennt die fehlenden Abschnitte', () => {
    expect(monetizationAvailability(makeProject())).toEqual({
      available: false,
      completeness: 0,
      belowThreshold: true,
      missingSections: ['problem', 'audience', 'features'],
    })
  })

  it('braucht Inhalt in den Pflichtabschnitten, auch bei hoher Vollständigkeit', () => {
    const project = withMaturity(makeProject(), {
      problem: 'decided',
      audience: 'decided',
      features: 'decided',
      flows: 'decided',
      techStack: 'decided',
    })

    const result = monetizationAvailability(project)

    expect(result.belowThreshold).toBe(false)
    expect(result.available).toBe(false)
  })

  it('ist ab 60 % mit gefüllten Pflichtabschnitten verfügbar', () => {
    // Gewichte: problem 3, audience 2, features 3, flows 2, techStack 2 → 12 von 17 ≈ 71 %
    const project = withMaturity(filled(makeProject()), {
      problem: 'decided',
      audience: 'decided',
      features: 'decided',
      flows: 'decided',
      techStack: 'decided',
    })

    expect(monetizationAvailability(project)).toMatchObject({
      available: true,
      belowThreshold: false,
      missingSections: [],
    })
  })

  it('bleibt unter 60 % gesperrt', () => {
    const project = filled(makeProject())

    expect(monetizationAvailability(project)).toMatchObject({
      available: false,
      belowThreshold: true,
      missingSections: [],
    })
  })
})

describe('Kombinationen', () => {
  it.each([
    [['ads', 'license'], ['adsWithLicense']],
    [['oneTime', 'subscription'], ['oneTimeWithSubscription']],
    [
      ['inAppPurchase', 'license', 'ads'],
      ['adsWithLicense', 'inAppWithLicense'],
    ],
    [['freemium', 'subscription'], []],
    [['ads'], []],
  ] as const)('%j → %j', (kinds, codes) => {
    expect(combinationWarnings(kinds).map((w) => w.code)).toEqual(codes)
  })

  it('erlaubt „nicht monetarisieren“ nur allein', () => {
    expect(isValidCombination(['none'])).toBe(true)
    expect(isValidCombination([])).toBe(true)
    expect(isValidCombination(['none', 'ads'])).toBe(false)
    expect(isValidCombination(['ads', 'subscription'])).toBe(true)
  })
})

describe('applyModelCandidates', () => {
  it('legt die Sektion an und bereinigt die Kandidaten', () => {
    const result = applyModelCandidates(
      makeProject(),
      {
        models: [
          candidate({
            title: '  Abo  ',
            summary: '  Monatlich.  ',
            concerns: ['a', ' A ', '', 'b', 'c', 'd'],
            // Eine fehlende Bewertung wird nicht erfunden: das Modell gilt als unbewertet.
            scores: { ...scores, userAcceptance: NaN },
            recommended: true,
          }),
        ],
      },
      { createId: ids('m') },
    )

    const [first] = mon(result).models
    expect(first).toEqual({
      id: 'm1',
      kind: 'subscription',
      title: 'Abo',
      summary: 'Monatlich.',
      fitReason: 'Laufender Nutzen.',
      concerns: ['a', 'b', 'c'],
      scores: null,
      recommended: true,
    })
    expect(first?.concerns).toHaveLength(MAX_MODEL_CONCERNS)
    expect(() => projectSchema.parse(result)).not.toThrow()
  })

  it('begrenzt Bewertungen auf ganze Zahlen von 1 bis 5', () => {
    const result = applyModelCandidates(makeProject(), {
      models: [candidate({ scores: { ...scores, revenuePotential: 9, techFit: 0.4 } })],
    })

    expect(mon(result).models[0]?.scores).toEqual({ ...scores, revenuePotential: 5, techFit: 1 })
  })

  it('verwirft Kandidaten ohne Beschreibung, doppelte Modelle und mehr als sechs', () => {
    const kinds = ['oneTime', 'freemium', 'usageBased', 'ads', 'commission', 'license'] as const
    const result = applyModelCandidates(
      makeProject(),
      {
        models: [
          candidate({ summary: '   ' }),
          candidate(),
          candidate({ title: 'Doppelt' }),
          ...kinds.map((kind) => candidate({ kind })),
        ],
      },
      { createId: ids('m') },
    )

    expect(mon(result).models.map((m) => m.kind)).toEqual([
      'subscription',
      'oneTime',
      'freemium',
      'usageBased',
      'ads',
      'commission',
    ])
  })

  it('behält gewählte Modelle und ersetzt nur die übrigen', () => {
    const project = withMonetization({
      models: [model('old1'), model('old2', { kind: 'ads' })],
      chosenModelIds: ['old1'],
      modelRationale: 'Passt',
    })

    const result = applyModelCandidates(
      project,
      { models: [candidate({ title: 'Neues Abo' }), candidate({ kind: 'freemium' })] },
      { createId: ids('n') },
    )

    expect(mon(result).models.map((m) => m.id)).toEqual(['old1', 'n1'])
    expect(mon(result).models[0]?.title).toBe('')
    expect(mon(result).chosenModelIds).toEqual(['old1'])
    expect(mon(result).modelRationale).toBe('Passt')
  })
})

describe('addManualModel', () => {
  it('ergänzt ein Modell ohne Bewertung', () => {
    const result = addManualModel(makeProject(), 'ads', () => 'x')

    expect(mon(result).models).toEqual([model('x', { kind: 'ads', summary: '' })])
  })

  it('lässt ein vorhandenes Modell unverändert', () => {
    const project = withMonetization({ models: [model('m1')] })

    expect(addManualModel(project, 'subscription', () => 'x')).toBe(project)
  })
})

describe('chooseModels', () => {
  it('wählt Modelle, entfernt Doppelte und trimmt die Begründung', () => {
    const result = chooseModels(withPaidModel(), ['m1', 'm2', 'm1'], '  Weil  ')

    expect(mon(result).chosenModelIds).toEqual(['m1', 'm2'])
    expect(mon(result).modelRationale).toBe('Weil')
  })

  it('verwirft die Preisstrategien, wenn sich die Auswahl ändert', () => {
    const project = choosePricing(withPaidModel(), ['p1'], 'Begründung')

    const result = chooseModels(project, ['m2'], '')

    expect(mon(result)).toMatchObject({
      pricingOptions: [],
      chosenPricingIds: [],
      pricingRationale: '',
    })
  })

  it('behält die Preisstrategien bei gleicher Auswahl und öffnet die Sektion wieder', () => {
    const decided = finalizeMonetization(choosePricing(withPaidModel(), ['p1'], ''), NOW)

    const result = chooseModels(decided, ['m1'], 'Neue Begründung')

    expect(mon(result)).toMatchObject({
      chosenPricingIds: ['p1'],
      modelRationale: 'Neue Begründung',
      status: 'open',
      decidedAt: null,
    })
  })

  it.each([
    [[], 'Mindestens ein Modell'],
    [['m1', 'm2', 'm3', 'm4'], 'Höchstens 3'],
    [['nope'], 'Unbekanntes Modell'],
    [['m1', 'm3'], 'nicht kombinieren'],
  ])('lehnt %j ab', (selection, message) => {
    const project = withMonetization({
      models: [
        model('m1'),
        model('m2', { kind: 'ads' }),
        model('m3', { kind: 'none' }),
        model('m4', { kind: 'license' }),
      ],
    })

    expect(() => chooseModels(project, selection, '')).toThrow(MonetizationError)
    expect(() => chooseModels(project, selection, '')).toThrow(message)
  })
})

describe('Preisstrategien', () => {
  it('braucht ein gewähltes Bezahlmodell', () => {
    const none = chooseModels(withPaidModel(), ['m3'], '')

    expect(needsPricing(mon(none))).toBe(false)
    expect(needsPricing(emptyMonetization())).toBe(false)
    expect(() => applyPricingCandidates(none, { strategies: [] })).toThrow(MonetizationError)
    expect(() => addManualPricing(none, 'tiers')).toThrow(MonetizationError)
    expect(() => choosePricing(none, ['p1'], '')).toThrow(MonetizationError)
  })

  it('übernimmt Kandidaten bereinigt und behält gewählte Strategien', () => {
    const project = choosePricing(withPaidModel(), ['p2'], '')

    const result = applyPricingCandidates(
      project,
      {
        strategies: [
          pricingCandidate({ title: ' Pakete ', examplePrices: ' 4–8 € ' }),
          pricingCandidate({ strategy: 'penetration' }),
          pricingCandidate({ strategy: 'anchor', summary: ' ' }),
          pricingCandidate({ strategy: 'perSeat', recommended: true }),
        ],
      },
      { createId: ids('q') },
    )

    expect(mon(result).pricingOptions.map((o) => [o.id, o.strategy])).toEqual([
      ['p2', 'penetration'],
      ['q1', 'tiers'],
      ['q2', 'perSeat'],
    ])
    expect(mon(result).pricingOptions[1]).toMatchObject({
      title: 'Pakete',
      examplePrices: '4–8 €',
    })
    expect(() => projectSchema.parse(result)).not.toThrow()
  })

  it('begrenzt auf fünf neue Strategien', () => {
    const strategies = [
      'tiers',
      'valueBased',
      'competitive',
      'penetration',
      'skimming',
      'perSeat',
    ] as const
    const project = withMonetization({ models: [model('m1')], chosenModelIds: ['m1'] })

    const result = applyPricingCandidates(project, {
      strategies: strategies.map((strategy) => pricingCandidate({ strategy })),
    })

    expect(mon(result).pricingOptions).toHaveLength(5)
  })

  it('ergänzt eine Strategie von Hand nur einmal', () => {
    const once = addManualPricing(withPaidModel(), 'anchor', () => 'a1')

    expect(mon(once).pricingOptions.at(-1)).toEqual(
      pricing('a1', { strategy: 'anchor', summary: '' }),
    )
    expect(addManualPricing(once, 'anchor', () => 'a2')).toBe(once)
  })

  it.each([
    [[], 'Mindestens eine'],
    [['p1', 'p2', 'p3'], 'Höchstens 2'],
    [['x'], 'Unbekannte Preisstrategie'],
  ])('lehnt die Auswahl %j ab', (selection, message) => {
    const project = addManualPricing(withPaidModel(), 'anchor', () => 'p3')

    expect(() => choosePricing(project, selection, '')).toThrow(message)
  })
})

describe('Abschließen', () => {
  it('schließt mit Modell und Preisstrategie ab', () => {
    const project = choosePricing(withPaidModel(), ['p1', 'p2'], ' Grund ')

    const result = finalizeMonetization(project, NOW)

    expect(mon(result)).toMatchObject({
      chosenPricingIds: ['p1', 'p2'],
      pricingRationale: 'Grund',
      status: 'decided',
      decidedAt: NOW.toISOString(),
    })
    expect(() => projectSchema.parse(result)).not.toThrow()
  })

  it('schließt „nicht monetarisieren“ ohne Preisstrategie ab', () => {
    const project = chooseModels(withPaidModel(), ['m3'], 'Hobby')

    expect(canFinalize(mon(project))).toBe(true)
    expect(mon(finalizeMonetization(project, NOW)).status).toBe('decided')
  })

  it('verlangt Modell und bei Bezahlmodellen eine Preisstrategie', () => {
    expect(() => finalizeMonetization(makeProject(), NOW)).toThrow(MonetizationError)
    expect(() => finalizeMonetization(withPaidModel(), NOW)).toThrow(MonetizationError)
  })

  it('öffnet wieder und setzt zurück', () => {
    const decided = finalizeMonetization(chooseModels(withPaidModel(), ['m3'], ''), NOW)

    const reopened = reopenMonetization(decided)

    expect(mon(reopened)).toMatchObject({ status: 'open', decidedAt: null, chosenModelIds: ['m3'] })
    expect(reopenMonetization(reopened)).toBe(reopened)
    expect(reopenMonetization(makeProject()).monetization).toBeNull()
    expect(resetMonetization(decided).monetization).toBeNull()
    const empty = makeProject()
    expect(resetMonetization(empty)).toBe(empty)
  })
})

describe('monetizationImpacts', () => {
  it('leitet Auswirkungen aus den gewählten Modellen ab, ohne Doppelte', () => {
    const project = withMonetization({
      models: [model('m1'), model('m2', { kind: 'ads' }), model('m3', { kind: 'usageBased' })],
      chosenModelIds: ['m1', 'm3', 'm2'],
    })

    expect(monetizationImpacts(mon(project))).toEqual([
      { code: 'payments', sectionId: 'integrations' },
      { code: 'accounts', sectionId: 'dataModel' },
      { code: 'usageMetering', sectionId: 'dataModel' },
      { code: 'adNetwork', sectionId: 'integrations' },
      { code: 'adPrivacy', sectionId: 'risks' },
    ])
  })

  it('hat für „nicht monetarisieren“ keine Auswirkungen', () => {
    const project = withMonetization({
      models: [model('m1', { kind: 'none' })],
      chosenModelIds: ['m1'],
    })

    expect(monetizationImpacts(mon(project))).toEqual([])
  })
})

describe('appendImpactNote', () => {
  it('füllt einen leeren Abschnitt als eigenen Inhalt', () => {
    const result = appendImpactNote(makeProject(), 'integrations', '- Zahlungsanbieter')

    expect(result.blueprint.sections.integrations).toMatchObject({
      content: '- Zahlungsanbieter',
      source: 'user',
      maturity: 'vague',
    })
  })

  it('hängt an, behält die Reife und macht den Abschnitt zu eigenem Inhalt', () => {
    const base = updateSection(makeProject(), 'risks', {
      content: 'KI-Text\n',
      source: 'aiSuggestion',
      maturity: 'decided',
    })

    const result = appendImpactNote(base, 'risks', 'Datenschutz bei Werbung')

    expect(result.blueprint.sections.risks).toMatchObject({
      content: 'KI-Text\n- Datenschutz bei Werbung',
      // Wie jede Bearbeitung von Hand: eine spätere Einordnung überschreibt den Punkt nicht.
      source: 'user',
      maturity: 'decided',
    })
  })

  it('fügt einen schon vorhandenen Punkt nicht erneut ein', () => {
    const base = updateSection(makeProject(), 'risks', { content: '* Datenschutz   bei Werbung' })

    expect(appendImpactNote(base, 'risks', 'datenschutz bei werbung')).toBe(base)
    expect(appendImpactNote(base, 'risks', '  ')).toBe(base)
    expect(hasImpactNote(base, 'risks', '- Datenschutz bei Werbung')).toBe(true)
    expect(hasImpactNote(base, 'risks', 'Anderes')).toBe(false)
  })
})

describe('KI-Aufrufe', () => {
  it('fragt Modelle mit Schema an', async () => {
    const provider = new MockAiProvider([JSON.stringify({ models: [candidate()] })])

    const { result, promptId, promptVersion } = await suggestMonetizationModels({
      provider,
      project: makeProject(),
      language: 'de',
    })

    expect(result.models).toHaveLength(1)
    expect(promptId).toBe('suggest-monetization-models')
    expect(promptVersion).toBe(1)
    expect(provider.requests[0]?.jsonSchema?.name).toBe('monetization_models')
  })

  it('fragt Preisstrategien nur mit Bezahlmodell an', async () => {
    const provider = new MockAiProvider([JSON.stringify({ strategies: [pricingCandidate()] })])

    await expect(
      suggestPricingStrategies({ provider, project: makeProject(), language: 'de' }),
    ).rejects.toThrow(MonetizationError)

    const { result, promptId } = await suggestPricingStrategies({
      provider,
      project: withPaidModel(),
      language: 'en',
    })
    expect(result.strategies).toHaveLength(1)
    expect(promptId).toBe('suggest-pricing-strategies')
    expect(provider.requests).toHaveLength(1)
  })
})
