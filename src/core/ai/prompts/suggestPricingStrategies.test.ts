import type { Monetization, Project } from '@/core/blueprint/schema'
import { PRICING_STRATEGY_KINDS } from '@/core/blueprint/schema'
import { updateSection } from '@/core/blueprint/editing'
import { makeProject } from '@/core/blueprint/testing'
import type { ChatMessage } from '../types'
import {
  buildSuggestPricingStrategiesMessages,
  MAX_PRICING_CANDIDATES,
  pricingStrategiesResultSchema,
  SUGGEST_PRICING_STRATEGIES_PROMPT_ID,
  SUGGEST_PRICING_STRATEGIES_PROMPT_VERSION,
} from './suggestPricingStrategies'

const asText = (messages: ChatMessage[]) =>
  messages.map((m) => `### ${m.role}\n${m.content}`).join('\n\n')

const monetization: Monetization = {
  models: [
    {
      id: 'm1',
      kind: 'freemium',
      title: 'Kostenlos für kleine Teams',
      summary: 'Bis 3 Personen kostenlos, danach Pro.',
      fitReason: '',
      concerns: [],
      scores: null,
      recommended: true,
    },
    {
      id: 'm2',
      kind: 'subscription',
      title: '',
      summary: '',
      fitReason: '',
      concerns: [],
      scores: null,
      recommended: false,
    },
    {
      id: 'm3',
      kind: 'ads',
      title: 'Werbung',
      summary: 'Nicht gewählt.',
      fitReason: '',
      concerns: [],
      scores: null,
      recommended: false,
    },
  ],
  chosenModelIds: ['m1', 'm2'],
  modelRationale: 'Teams zahlen für Zusammenarbeit.',
  pricingOptions: [],
  chosenPricingIds: [],
  pricingRationale: '',
  status: 'open',
  decidedAt: null,
}

const project: Project & { monetization: Monetization } = {
  ...updateSection(makeProject({ name: 'Teamplaner' }), 'audience', {
    content: 'Teams mit 3–20 Personen.',
    maturity: 'decided',
  }),
  monetization,
}

const build = (input = project, language: 'de' | 'en' = 'de') =>
  buildSuggestPricingStrategiesMessages({ project: input, language })

describe('buildSuggestPricingStrategiesMessages', () => {
  it('Golden File', async () => {
    await expect(asText(build())).toMatchFileSnapshot(
      './__golden__/suggest-pricing-strategies-team.txt',
    )
  })

  it('hat ID, Version und System- vor Nutzernachricht', () => {
    expect(SUGGEST_PRICING_STRATEGIES_PROMPT_ID).toBe('suggest-pricing-strategies')
    expect(SUGGEST_PRICING_STRATEGIES_PROMPT_VERSION).toBe(1)
    expect(build().map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('nennt alle Strategien, die Obergrenze und die Regel zu Preisspannen', () => {
    const system = build()[0]!.content

    for (const strategy of PRICING_STRATEGY_KINDS) expect(system).toContain(`- ${strategy}: `)
    expect(system).toContain(`3–${MAX_PRICING_CANDIDATES} Strategien`)
    expect(system).toContain('Nenne immer Spannen')
  })

  it('übergibt nur die gewählten Modelle mit Begründung', () => {
    const user = build()[1]!.content

    expect(user).toContain('- freemium – Kostenlos für kleine Teams: Bis 3 Personen kostenlos')
    expect(user).toContain('- subscription: (ohne Beschreibung)')
    expect(user).toContain('Begründung: Teams zahlen für Zusammenarbeit.')
    expect(user).not.toContain('Nicht gewählt.')
  })

  it('kommt ohne gewählte Modelle und Begründung aus', () => {
    const user = build({
      ...project,
      monetization: { ...monetization, chosenModelIds: ['missing'], modelRationale: ' ' },
    })[1]!.content

    expect(user).toContain('# Gewählte Monetarisierung\n(keine)\n')
    expect(build(project, 'en')[0]!.content).toContain('auf Englisch')
  })

  it('lehnt unbekannte Strategien im Ergebnis ab', () => {
    const entry = {
      title: '',
      summary: 'x',
      examplePrices: '',
      reason: '',
      recommended: false,
    }

    expect(
      pricingStrategiesResultSchema.safeParse({ strategies: [{ ...entry, strategy: 'tiers' }] })
        .success,
    ).toBe(true)
    expect(
      pricingStrategiesResultSchema.safeParse({ strategies: [{ ...entry, strategy: 'free' }] })
        .success,
    ).toBe(false)
  })
})
