import type { Decision, InterviewLogEntry, Project } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import { makeProject } from '@/core/blueprint/testing'
import type { ChatMessage } from '../types'
import {
  buildIdentifyDecisionsMessages,
  decisionsResultSchema,
  IDENTIFY_DECISIONS_PROMPT_ID,
  IDENTIFY_DECISIONS_PROMPT_VERSION,
  MAX_DECISION_CANDIDATES,
  MAX_DECISION_OPTIONS,
} from './identifyDecisions'

// ---------------------------------------------------------------------------
// Feste Beispiele
// ---------------------------------------------------------------------------

const CREATED = '2026-01-10T09:00:00.000Z'

/** Textform der Nachrichten, mit der die Golden Files verglichen werden. */
const asText = (messages: ChatMessage[]) =>
  messages.map((m) => `### ${m.role}\n${m.content}`).join('\n\n')

/** Projekt mit gesetzten Abschnitten (Inhalt und Reife); übrige bleiben leer. */
function withSections(
  base: Project,
  sections: Partial<Record<SectionId, { content: string; maturity: 'vague' | 'decided' }>>,
): Project {
  const copy = { ...base.blueprint.sections }
  for (const [id, value] of Object.entries(sections) as [
    SectionId,
    { content: string; maturity: 'vague' | 'decided' },
  ][]) {
    copy[id] = { ...copy[id], ...value }
  }
  return { ...base, blueprint: { sections: copy } }
}

function decision(id: string, overrides: Partial<Decision> = {}): Decision {
  return {
    id,
    sectionId: 'techStack',
    title: `Frage ${id}?`,
    context: '',
    leverage: 4,
    options: [
      { id: `${id}-a`, label: 'Web', pros: [], cons: [], consequence: '' },
      { id: `${id}-b`, label: 'Nativ', pros: [], cons: [], consequence: '' },
    ],
    recommendedOptionId: null,
    chosenOptionId: null,
    rationale: '',
    status: 'open',
    createdAt: CREATED,
    decidedAt: null,
    ...overrides,
  }
}

const logEntry = (
  questionId: string,
  sectionId: SectionId,
  questionText: string,
  answerText: string,
): InterviewLogEntry => ({
  questionId,
  questionText,
  sectionId,
  action: 'answered',
  answerText,
  at: CREATED,
})

/** Vager Blueprint: nur das Problem ist angedeutet, sonst nichts. */
const vagueProject: Project = withSections(makeProject({ name: 'Wochenplaner' }), {
  problem: {
    content: 'Wochenplanung mit Rezepten kostet Zeit und endet oft ohne Einkaufsliste.',
    maturity: 'vague',
  },
})

/** Fast fertiger Blueprint mit einer getroffenen und einer verworfenen Entscheidung. */
const almostDoneProject: Project = (() => {
  const base = withSections(makeProject({ name: 'Habit-Tracker' }), {
    problem: { content: 'Gewohnheiten werden nicht konsequent verfolgt.', maturity: 'decided' },
    audience: { content: 'Einzelpersonen, die Gewohnheiten aufbauen wollen.', maturity: 'decided' },
    features: {
      content: '- Gewohnheiten anlegen\n- Täglich abhaken\n- Streak-Anzeige',
      maturity: 'decided',
    },
    techStack: { content: 'Web-App, Node.js-Backend, PostgreSQL.', maturity: 'decided' },
    dataModel: { content: 'Gewohnheiten und tägliche Abhakungen.', maturity: 'vague' },
  })
  return {
    ...base,
    interview: {
      questions: [],
      log: [
        logEntry('a1', 'audience', 'Wer nutzt die App?', 'Einzelpersonen – Für mich'),
        logEntry('a2', 'features', 'Was gehört zum Kern?', 'Täglich abhaken'),
      ],
      analysis: null,
    },
    decisions: [
      decision('d-platform', {
        sectionId: 'techStack',
        title: 'Web oder nativ?',
        status: 'decided',
        chosenOptionId: 'd-platform-a',
        rationale: 'Ein Browser reicht für den Anfang.',
        decidedAt: CREATED,
      }),
      decision('d-theme', {
        sectionId: 'flows',
        title: 'Farbschema?',
        status: 'dismissed',
      }),
      decision('d-open', {
        sectionId: 'dataModel',
        title: 'Lokal oder Server?',
        status: 'open',
      }),
    ],
  }
})()

const build = (project: Project, language: 'de' | 'en' = 'de') =>
  buildIdentifyDecisionsMessages({ project, language })

const userText = (project: Project, language: 'de' | 'en' = 'de') =>
  build(project, language).find((m) => m.role === 'user')?.content ?? ''

const systemText = (project: Project, language: 'de' | 'en' = 'de') =>
  build(project, language).find((m) => m.role === 'system')?.content ?? ''

// ---------------------------------------------------------------------------
// Golden Files: der vollständige Prompt bleibt stabil.
// Bei inhaltlichen Änderungen VERSION erhöhen und die Dateien neu erzeugen.
// ---------------------------------------------------------------------------

describe('buildIdentifyDecisionsMessages – Golden Files', () => {
  it('vager Blueprint', async () => {
    await expect(asText(build(vagueProject))).toMatchFileSnapshot(
      './__golden__/identify-decisions-vague.txt',
    )
  })

  it('fast fertiger Blueprint mit getroffener und verworfener Entscheidung', async () => {
    await expect(asText(build(almostDoneProject))).toMatchFileSnapshot(
      './__golden__/identify-decisions-almost-done.txt',
    )
  })
})

// ---------------------------------------------------------------------------
// Aufbau der Nachrichten
// ---------------------------------------------------------------------------

describe('buildIdentifyDecisionsMessages', () => {
  it('liefert eine System- und eine Nutzernachricht in dieser Reihenfolge', () => {
    expect(build(vagueProject).map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('hat eine ID und eine Version', () => {
    expect(IDENTIFY_DECISIONS_PROMPT_ID).toMatch(/^[a-z-]+$/)
    expect(Number.isInteger(IDENTIFY_DECISIONS_PROMPT_VERSION)).toBe(true)
    expect(IDENTIFY_DECISIONS_PROMPT_VERSION).toBeGreaterThanOrEqual(1)
  })

  it('nennt die Obergrenzen für Entscheidungen und Optionen', () => {
    const system = systemText(vagueProject)

    expect(system).toContain(`höchstens ${MAX_DECISION_CANDIDATES} Entscheidungen`)
    expect(system).toContain(`2–${MAX_DECISION_OPTIONS} realistische`)
  })

  it('weist die Ausgabesprache aus', () => {
    expect(systemText(vagueProject, 'de')).toContain('auf Deutsch')
    expect(systemText(vagueProject, 'en')).toContain('Englisch')
  })

  it('nennt alle Abschnitte mit ihrer Beschreibung im System-Prompt', () => {
    const system = systemText(vagueProject)

    expect(system).toContain('- techStack: Tech-Stack & Plattform')
    expect(system).toContain('- roadmap: Umsetzungs-Roadmap')
  })

  it('listet getroffene und verworfene Entscheidungen, offene nicht', () => {
    const user = userText(almostDoneProject)
    const section = user.slice(user.indexOf('# Getroffene oder verworfene Entscheidungen'))

    expect(section).toContain('- [techStack] Web oder nativ? → Web')
    expect(section).toContain('- [flows] Farbschema? → (verworfen)')
    expect(section).not.toContain('Lokal oder Server?')
  })

  it('schreibt „(keine)“, wenn es weder getroffene noch verworfene Entscheidungen gibt', () => {
    expect(userText(vagueProject)).toContain('# Getroffene oder verworfene Entscheidungen\n(keine)')
  })

  it('nimmt die bisherigen Antworten auf, sonst „(noch keine)“', () => {
    expect(userText(almostDoneProject)).toContain(
      '- [audience] Wer nutzt die App? → Einzelpersonen – Für mich',
    )
    expect(userText(vagueProject)).toContain('# Bisherige Antworten\n(noch keine)')
  })

  it('nennt den Projektnamen und den Blueprint', () => {
    const user = userText(vagueProject)

    expect(user.startsWith('Projekt: Wochenplaner')).toBe(true)
    expect(user).toContain('## problem [vague]')
  })
})

// ---------------------------------------------------------------------------
// Antwortschema
// ---------------------------------------------------------------------------

describe('decisionsResultSchema', () => {
  const option = { label: 'Web', pros: ['Läuft überall'], cons: ['Kein Store'], consequence: 'x' }
  const candidate = {
    sectionId: 'techStack',
    title: 'Web oder nativ?',
    context: 'Bestimmt den Aufwand.',
    leverage: 5,
    options: [option, { ...option, label: 'Nativ' }],
    recommendedOption: 0,
  }
  const valid = { decisions: [candidate] }

  it('akzeptiert ein gültiges Ergebnis', () => {
    expect(decisionsResultSchema.safeParse(valid).success).toBe(true)
  })

  it('akzeptiert leere Listen und eine fehlende Empfehlung als null', () => {
    expect(decisionsResultSchema.safeParse({ decisions: [] }).success).toBe(true)
    expect(
      decisionsResultSchema.safeParse({
        decisions: [{ ...candidate, recommendedOption: null }],
      }).success,
    ).toBe(true)
  })

  it('akzeptiert Hebel außerhalb von 1–5, die später begrenzt werden', () => {
    expect(
      decisionsResultSchema.safeParse({ decisions: [{ ...candidate, leverage: 9 }] }).success,
    ).toBe(true)
  })

  const invalid: { name: string; data: unknown }[] = [
    {
      name: 'unbekannter Abschnitt',
      data: { decisions: [{ ...candidate, sectionId: 'backend' }] },
    },
    {
      name: 'Hebel als Text',
      data: { decisions: [{ ...candidate, leverage: 'hoch' }] },
    },
    {
      name: 'Optionen als Text statt Liste',
      data: { decisions: [{ ...candidate, options: 'Web' }] },
    },
    {
      name: 'Option ohne Vor- und Nachteile',
      data: { decisions: [{ ...candidate, options: [{ label: 'Web', consequence: 'x' }] }] },
    },
    {
      name: 'fehlende Empfehlung (nicht nullable, nur optional)',
      data: { decisions: [{ ...candidate, recommendedOption: undefined }] },
    },
    {
      name: 'Empfehlung als Text',
      data: { decisions: [{ ...candidate, recommendedOption: 'Web' }] },
    },
    {
      name: 'fehlende Liste der Entscheidungen',
      data: {},
    },
  ]

  it.each(invalid)('lehnt ab: $name', ({ data }) => {
    expect(decisionsResultSchema.safeParse(data).success).toBe(false)
  })
})
