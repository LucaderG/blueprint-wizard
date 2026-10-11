import type { InterviewLogEntry, Project, Question } from '@/core/blueprint/schema'
import { SECTION_IDS, type SectionId } from '@/core/blueprint/sections'
import { makeProject } from '@/core/blueprint/testing'
import type { ChatMessage } from '../types'
import {
  ANALYZE_BLUEPRINT_PROMPT_ID,
  ANALYZE_BLUEPRINT_PROMPT_VERSION,
  blueprintAnalysisResultSchema,
  buildAnalyzeBlueprintMessages,
  MAX_ANALYSIS_QUESTIONS,
  MAX_LOG_CONTEXT,
} from './analyzeBlueprint'

// ---------------------------------------------------------------------------
// Feste Beispiel-Blueprints
// ---------------------------------------------------------------------------

const CREATED = '2026-01-10T09:00:00.000Z'

/** Textform der Nachrichten, mit der die Golden Files verglichen werden. */
const asText = (messages: ChatMessage[]) =>
  messages.map((m) => `### ${m.role}\n${m.content}`).join('\n\n')

function question(id: string, sectionId: SectionId, overrides: Partial<Question> = {}): Question {
  return {
    id,
    sectionId,
    text: `Frage ${id}?`,
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

/** Projekt mit gesetzten Abschnitten (Inhalt und Reife); übrige bleiben leer. */
function projectWithSections(
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

/** Vager Blueprint: nur ein Satz zum Problem, sonst nichts. */
const vagueProject: Project = projectWithSections(
  makeProject({ name: 'Wochenplaner', entryPoint: 'partialIdea' }),
  {
    problem: {
      content: 'Wochenplanung mit Rezepten kostet Zeit und endet oft ohne Einkaufsliste.',
      maturity: 'vague',
    },
  },
)

const logEntry = (
  questionId: string,
  sectionId: SectionId,
  questionText: string,
  answerText: string,
  action: InterviewLogEntry['action'] = 'answered',
): InterviewLogEntry => ({
  questionId,
  questionText,
  sectionId,
  action,
  answerText,
  at: CREATED,
})

/** Fast fertiger Blueprint mit Verlauf und zwei zurückgestellten Fragen. */
const almostDoneProject: Project = (() => {
  const base = projectWithSections(
    makeProject({ name: 'Habit-Tracker', entryPoint: 'almostDone' }),
    {
      problem: {
        content: 'Gewohnheiten werden nicht konsequent verfolgt.',
        maturity: 'decided',
      },
      audience: {
        content: 'Einzelpersonen, die Gewohnheiten aufbauen wollen.',
        maturity: 'decided',
      },
      features: {
        content: '- Gewohnheiten anlegen\n- Täglich abhaken\n- Streak-Anzeige',
        maturity: 'decided',
      },
      nonGoals: {
        content: 'Social-Features und Push-Erinnerungen in Version 1.',
        maturity: 'decided',
      },
      techStack: { content: 'Web-App, Node.js-Backend, PostgreSQL.', maturity: 'decided' },
      dataModel: { content: 'Gewohnheiten und tägliche Abhakungen.', maturity: 'vague' },
      roadmap: { content: 'Beta nach zwei Wochen, danach Mobile-App.', maturity: 'decided' },
    },
  )
  const questions = [
    question('a1', 'audience', {
      text: 'Wer nutzt die App?',
      status: 'answered',
      answer: { kind: 'option', optionId: 'o1', note: 'Für mich' },
      answeredAt: CREATED,
      options: [{ id: 'o1', label: 'Einzelpersonen' }],
    }),
    question('a2', 'dataModel', {
      text: 'Welche Daten speichern wir?',
      status: 'answered',
      answer: { kind: 'text', text: 'Gewohnheiten und Abhakungen' },
      answeredAt: CREATED,
    }),
    question('a3', 'roadmap', {
      text: 'Wie lange läuft die Beta?',
      status: 'answered',
      answer: { kind: 'text', text: 'Zwei Wochen' },
      answeredAt: CREATED,
    }),
    question('q-push', 'nonGoals', {
      text: 'Sollen Push-Erinnerungen in Version 2 kommen?',
      status: 'deferred',
      leverage: 2,
    }),
    question('q-team', 'audience', {
      text: 'Gibt es später Teams?',
      status: 'deferred',
      leverage: 4,
    }),
  ]
  const log = [
    logEntry('a1', 'audience', 'Wer nutzt die App?', 'Einzelpersonen – Für mich'),
    logEntry('a2', 'dataModel', 'Welche Daten speichern wir?', 'Gewohnheiten und Abhakungen'),
    logEntry('q-push', 'nonGoals', 'Sollen Push-Erinnerungen in Version 2 kommen?', '', 'deferred'),
    logEntry('a3', 'roadmap', 'Wie lange läuft die Beta?', 'Zwei Wochen'),
  ]
  return { ...base, interview: { questions, log, analysis: null } }
})()

const build = (project: Project, language: 'de' | 'en' = 'de') =>
  buildAnalyzeBlueprintMessages({ project, language })

const userText = (project: Project, language: 'de' | 'en' = 'de') =>
  build(project, language).find((m) => m.role === 'user')?.content ?? ''

// ---------------------------------------------------------------------------
// Golden Files: der vollständige Prompt bleibt stabil.
// Bei inhaltlichen Änderungen VERSION erhöhen und die Dateien neu erzeugen.
// ---------------------------------------------------------------------------

describe('buildAnalyzeBlueprintMessages – Golden Files', () => {
  it('vager Blueprint', async () => {
    await expect(asText(build(vagueProject))).toMatchFileSnapshot(
      './__golden__/analyze-blueprint-vague.txt',
    )
  })

  it('fast fertiger Blueprint mit Verlauf und zurückgestellten Fragen', async () => {
    await expect(asText(build(almostDoneProject))).toMatchFileSnapshot(
      './__golden__/analyze-blueprint-almost-done.txt',
    )
  })
})

// ---------------------------------------------------------------------------
// Aufbau der Nachrichten
// ---------------------------------------------------------------------------

describe('buildAnalyzeBlueprintMessages', () => {
  it('liefert eine System- und eine Nutzernachricht in dieser Reihenfolge', () => {
    expect(build(vagueProject).map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('hat eine ID und eine Version', () => {
    expect(ANALYZE_BLUEPRINT_PROMPT_ID).toMatch(/^[a-z-]+$/)
    expect(Number.isInteger(ANALYZE_BLUEPRINT_PROMPT_VERSION)).toBe(true)
    expect(ANALYZE_BLUEPRINT_PROMPT_VERSION).toBeGreaterThanOrEqual(1)
  })

  it('nennt alle Abschnitte mit Reifegrad, auch leere', () => {
    const user = userText(vagueProject)

    for (const id of SECTION_IDS) {
      expect(user).toMatch(new RegExp(`## ${id} \\[(empty|vague|decided)\\]`))
    }
    expect(user).toContain('## problem [vague]')
    expect(user).toContain('## audience [empty]\n(leer)')
  })

  it('weist die Ausgabesprache aus', () => {
    const [de] = build(vagueProject, 'de')
    const [en] = build(vagueProject, 'en')

    expect(de?.content).toContain('auf Deutsch')
    expect(en?.content).toContain('Englisch')
  })

  it('beschreibt den Einstieg der Person', () => {
    expect(userText({ ...vagueProject, entryPoint: 'noIdea' })).toContain(
      'Die Person ist ohne konkrete Idee gestartet.',
    )
    expect(userText({ ...vagueProject, entryPoint: null })).not.toContain('Die Person ist')
  })

  it('schreibt den Verlauf nur mit beantworteten Fragen', () => {
    const user = userText(almostDoneProject)
    const history = user.slice(
      user.indexOf('# Bisherige Antworten'),
      user.indexOf('# Zurückgestellte'),
    )

    expect(history).toContain('- [audience] Wer nutzt die App? → Einzelpersonen – Für mich')
    expect(history).not.toContain('Sollen Push-Erinnerungen')
  })

  it('listet zurückgestellte Fragen, sonst „(keine)“', () => {
    expect(userText(almostDoneProject)).toContain(
      '- [nonGoals] Sollen Push-Erinnerungen in Version 2 kommen?',
    )
    expect(userText(vagueProject)).toContain('# Zurückgestellte Fragen\n(keine)')
  })

  it(`kürzt den Verlauf auf die letzten ${MAX_LOG_CONTEXT} beantworteten Einträge`, () => {
    const total = MAX_LOG_CONTEXT + 5
    const log = Array.from({ length: total }, (_, i) => {
      const n = String(i + 1).padStart(2, '0')
      return logEntry(`id-${n}`, 'risks', `Frage-${n}`, `Antwort-${n}`)
    })
    const user = userText({ ...vagueProject, interview: { questions: [], log, analysis: null } })

    expect(user).toContain(`Antwort-${String(total).padStart(2, '0')}`)
    expect(user).toContain('Antwort-06')
    expect(user).not.toContain('Antwort-05')
    expect(user).not.toContain('Antwort-01')
  })

  it('nennt die Obergrenze für Fragen im System-Prompt', () => {
    const [system] = build(vagueProject)

    expect(system?.content).toContain(`höchstens ${MAX_ANALYSIS_QUESTIONS} Fragen`)
  })
})

// ---------------------------------------------------------------------------
// Antwortschema
// ---------------------------------------------------------------------------

describe('blueprintAnalysisResultSchema', () => {
  const candidate = {
    key: 'q1',
    sectionId: 'audience',
    text: 'Für wen ist die App?',
    why: 'Bestimmt alle weiteren Entscheidungen.',
    leverage: 5,
    options: ['Einzelpersonen', 'Teams'],
    dependsOn: [],
  }
  const valid = {
    summary: 'Die Idee ist klar, Zielgruppe fehlt.',
    gaps: [{ sectionIds: ['audience'], text: 'Zielgruppe fehlt' }],
    contradictions: [],
    questions: [candidate],
  }

  it('akzeptiert ein gültiges Ergebnis', () => {
    expect(blueprintAnalysisResultSchema.safeParse(valid).success).toBe(true)
  })

  it('akzeptiert leere Listen', () => {
    expect(
      blueprintAnalysisResultSchema.safeParse({
        summary: '',
        gaps: [],
        contradictions: [],
        questions: [],
      }).success,
    ).toBe(true)
  })

  it('akzeptiert Hebel außerhalb von 1–5, die später begrenzt werden', () => {
    const outOfRange = { ...valid, questions: [{ ...candidate, leverage: 9 }] }

    expect(blueprintAnalysisResultSchema.safeParse(outOfRange).success).toBe(true)
  })

  const { summary: _summary, ...withoutSummary } = valid
  const invalid: { name: string; data: unknown }[] = [
    {
      name: 'unbekannter Abschnitt bei einer Frage',
      data: { ...valid, questions: [{ ...candidate, sectionId: 'backend' }] },
    },
    {
      name: 'unbekannter Abschnitt bei einer Lücke',
      data: { ...valid, gaps: [{ sectionIds: ['backend'], text: 'x' }] },
    },
    { name: 'fehlende Zusammenfassung', data: withoutSummary },
    {
      name: 'Hebel als Text',
      data: { ...valid, questions: [{ ...candidate, leverage: 'hoch' }] },
    },
    {
      name: 'Optionen als Text statt Liste',
      data: { ...valid, questions: [{ ...candidate, options: 'Web' }] },
    },
    {
      name: 'Frage ohne Schlüssel',
      data: { ...valid, questions: [{ ...candidate, key: undefined }] },
    },
  ]

  it.each(invalid)('lehnt ab: $name', ({ data }) => {
    expect(blueprintAnalysisResultSchema.safeParse(data).success).toBe(false)
  })
})
