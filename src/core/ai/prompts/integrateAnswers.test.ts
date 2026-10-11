import type { Section } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import type { ChatMessage } from '../types'
import { SECTION_GUIDE } from './classifyIdea'
import {
  buildIntegrateAnswersMessages,
  INTEGRATE_ANSWERS_PROMPT_ID,
  INTEGRATE_ANSWERS_PROMPT_VERSION,
  integrationResultSchema,
  type AnsweredQuestion,
} from './integrateAnswers'

// ---------------------------------------------------------------------------
// Feste Beispiele
// ---------------------------------------------------------------------------

const asText = (messages: ChatMessage[]) =>
  messages.map((m) => `### ${m.role}\n${m.content}`).join('\n\n')

const section = (
  id: SectionId,
  content: string,
  maturity: Section['maturity'],
): Pick<Section, 'id' | 'content' | 'maturity'> => ({ id, content, maturity })

/** Betroffene Abschnitte: Kernfunktionen (teilweise gefüllt) und Zielgruppe (leer). */
const sections = [
  section('features', '- Gewohnheiten anlegen\n- Streak-Anzeige', 'vague'),
  section('audience', '', 'empty'),
]

const answers: AnsweredQuestion[] = [
  {
    sectionId: 'features',
    question: 'Was gehört zum Kern der ersten Version?',
    answer: 'Täglich abhaken',
  },
  {
    sectionId: 'audience',
    question: 'Für wen ist die App gedacht?',
    answer: 'Einzelpersonen – Für mich',
  },
]

const input: { sections: typeof sections; answers: AnsweredQuestion[]; language: 'de' | 'en' } = {
  sections,
  answers,
  language: 'de',
}

const build = (overrides: Partial<typeof input> = {}) =>
  buildIntegrateAnswersMessages({ ...input, ...overrides })

const userText = (overrides: Partial<typeof input> = {}) =>
  build(overrides).find((m) => m.role === 'user')?.content ?? ''

// ---------------------------------------------------------------------------
// Golden File
// ---------------------------------------------------------------------------

describe('buildIntegrateAnswersMessages – Golden File', () => {
  it('Kernfunktionen und Zielgruppe mit zwei Antworten', async () => {
    await expect(asText(build())).toMatchFileSnapshot('./__golden__/integrate-answers-basic.txt')
  })
})

// ---------------------------------------------------------------------------
// Aufbau der Nachrichten
// ---------------------------------------------------------------------------

describe('buildIntegrateAnswersMessages', () => {
  it('hat eine ID und eine Version', () => {
    expect(INTEGRATE_ANSWERS_PROMPT_ID).toMatch(/^[a-z-]+$/)
    expect(INTEGRATE_ANSWERS_PROMPT_VERSION).toBeGreaterThanOrEqual(1)
  })

  it('liefert eine System- und eine Nutzernachricht in dieser Reihenfolge', () => {
    expect(build().map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('weist die Ausgabesprache aus', () => {
    const [de] = build({ language: 'de' })
    const [en] = build({ language: 'en' })

    expect(de?.content).toContain('auf Deutsch')
    expect(en?.content).toContain('Englisch')
  })

  it('nennt den Zweck jedes betroffenen Abschnitts', () => {
    const user = userText()

    expect(user).toContain(`## features [vague]\n(${SECTION_GUIDE.features})`)
    expect(user).toContain(`## audience [empty]\n(${SECTION_GUIDE.audience})`)
  })

  it('kennzeichnet leere Abschnitte mit „(leer)“', () => {
    expect(userText()).toContain(`## audience [empty]\n(${SECTION_GUIDE.audience})\n(leer)`)
  })

  it('reicht den bestehenden Inhalt unverändert durch', () => {
    expect(userText()).toContain('- Gewohnheiten anlegen\n- Streak-Anzeige')
  })

  it('formuliert jede Antwort mit Frage und Antwort', () => {
    const user = userText()

    expect(user).toContain(
      '- [features] Frage: Was gehört zum Kern der ersten Version?\n  Antwort: Täglich abhaken',
    )
    expect(user).toContain(
      '- [audience] Frage: Für wen ist die App gedacht?\n  Antwort: Einzelpersonen – Für mich',
    )
  })
})

// ---------------------------------------------------------------------------
// Antwortschema
// ---------------------------------------------------------------------------

describe('integrationResultSchema', () => {
  const valid = {
    sections: [{ id: 'features', content: '- Gewohnheiten anlegen', maturity: 'decided' }],
  }

  it('akzeptiert ein gültiges Ergebnis', () => {
    expect(integrationResultSchema.safeParse(valid).success).toBe(true)
  })

  it('akzeptiert eine leere Liste (keine Änderung)', () => {
    expect(integrationResultSchema.safeParse({ sections: [] }).success).toBe(true)
  })

  it('akzeptiert den Reifegrad „empty“ (wird später zu „vague“)', () => {
    const data = { sections: [{ ...valid.sections[0], maturity: 'empty' }] }

    expect(integrationResultSchema.safeParse(data).success).toBe(true)
  })

  it.each([
    {
      name: 'unbekannter Abschnitt',
      data: { sections: [{ id: 'backend', content: 'x', maturity: 'decided' }] },
    },
    {
      name: 'unbekannter Reifegrad',
      data: { sections: [{ id: 'features', content: 'x', maturity: 'done' }] },
    },
    {
      name: 'Inhalt fehlt',
      data: { sections: [{ id: 'features', maturity: 'decided' }] },
    },
    { name: 'Abschnitte fehlen', data: {} },
  ])('lehnt ab: $name', ({ data }) => {
    expect(integrationResultSchema.safeParse(data).success).toBe(false)
  })
})
