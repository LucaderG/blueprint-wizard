import type { Project } from '@/core/blueprint/schema'
import { MONETIZATION_MODEL_KINDS } from '@/core/blueprint/schema'
import { updateSection } from '@/core/blueprint/editing'
import { makeProject } from '@/core/blueprint/testing'
import type { ChatMessage } from '../types'
import {
  buildSuggestMonetizationModelsMessages,
  MAX_MODEL_CANDIDATES,
  monetizationModelsResultSchema,
  SUGGEST_MONETIZATION_MODELS_PROMPT_ID,
  SUGGEST_MONETIZATION_MODELS_PROMPT_VERSION,
} from './suggestMonetizationModels'

const asText = (messages: ChatMessage[]) =>
  messages.map((m) => `### ${m.role}\n${m.content}`).join('\n\n')

/** Fast fertiger Blueprint einer Team-App mit einer getroffenen Entscheidung. */
const project: Project = (() => {
  let base = makeProject({ name: 'Teamplaner' })
  base = updateSection(base, 'problem', {
    content: 'Kleine Teams verlieren den Überblick über Aufgaben.',
    maturity: 'decided',
  })
  base = updateSection(base, 'audience', {
    content: 'Teams mit 3–20 Personen.',
    maturity: 'decided',
  })
  base = updateSection(base, 'features', {
    content: '- Aufgaben anlegen\n- Zuständigkeiten\n- Wochenübersicht',
    maturity: 'decided',
  })
  base = updateSection(base, 'techStack', { content: 'Web-App mit Server.', maturity: 'vague' })
  return {
    ...base,
    decisions: [
      {
        id: 'd1',
        sectionId: 'techStack',
        title: 'Web oder nativ?',
        context: '',
        leverage: 5,
        options: [
          { id: 'd1-a', label: 'Web', pros: [], cons: [], consequence: '' },
          { id: 'd1-b', label: 'Nativ', pros: [], cons: [], consequence: '' },
        ],
        recommendedOptionId: null,
        chosenOptionId: 'd1-a',
        rationale: '',
        status: 'decided',
        createdAt: '2026-01-10T09:00:00.000Z',
        decidedAt: '2026-01-10T09:00:00.000Z',
      },
    ],
  }
})()

const build = (language: 'de' | 'en' = 'de') =>
  buildSuggestMonetizationModelsMessages({ project, language })

describe('buildSuggestMonetizationModelsMessages', () => {
  it('Golden File', async () => {
    await expect(asText(build())).toMatchFileSnapshot(
      './__golden__/suggest-monetization-models-team.txt',
    )
  })

  it('hat ID, Version und System- vor Nutzernachricht', () => {
    expect(SUGGEST_MONETIZATION_MODELS_PROMPT_ID).toBe('suggest-monetization-models')
    expect(SUGGEST_MONETIZATION_MODELS_PROMPT_VERSION).toBe(1)
    expect(build().map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('nennt alle erlaubten Modelle und die Obergrenze', () => {
    const system = build()[0]!.content

    for (const kind of MONETIZATION_MODEL_KINDS) expect(system).toContain(`- ${kind}: `)
    expect(system).toContain(`4–${MAX_MODEL_CANDIDATES} Modelle`)
    expect(system).toContain('Erfinde keine Marktzahlen')
  })

  it('übergibt Blueprint und Entscheidungen und weist die Sprache aus', () => {
    const user = build()[1]!.content

    expect(user).toContain('Kleine Teams verlieren den Überblick')
    expect(user).toContain('- [techStack] Web oder nativ? → Web')
    expect(build('en')[0]!.content).toContain('auf Englisch')
  })

  it('lehnt unbekannte Modelle im Ergebnis ab', () => {
    const scores = {
      revenuePotential: 3,
      implementationEase: 3,
      userAcceptance: 3,
      predictability: 3,
      audienceFit: 3,
      techFit: 3,
    }
    const entry = {
      title: '',
      summary: 'x',
      fitReason: '',
      concerns: [],
      scores,
      recommended: false,
    }

    expect(
      monetizationModelsResultSchema.safeParse({ models: [{ ...entry, kind: 'ads' }] }).success,
    ).toBe(true)
    expect(
      monetizationModelsResultSchema.safeParse({ models: [{ ...entry, kind: 'barter' }] }).success,
    ).toBe(false)
  })
})
