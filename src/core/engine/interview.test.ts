import { AiError } from '@/core/ai/errors'
import {
  ANALYZE_BLUEPRINT_PROMPT_ID,
  ANALYZE_BLUEPRINT_PROMPT_VERSION,
  INTEGRATE_ANSWERS_PROMPT_ID,
  INTEGRATE_ANSWERS_PROMPT_VERSION,
  MAX_ANALYSIS_QUESTIONS,
  type BlueprintAnalysisResult,
  type QuestionCandidate,
} from '@/core/ai/prompts'
import { MockAiProvider } from '@/core/ai/mockProvider'
import type {
  InterviewLogEntry,
  Maturity,
  Project,
  Question,
  QuestionAnswer,
  Section,
} from '@/core/blueprint/schema'
import { projectSchema } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import { updateSection } from '@/core/blueprint/editing'
import { makeProject } from '@/core/blueprint/testing'
import {
  analyzeBlueprint,
  answerQuestion,
  appendAnswersToSections,
  applyAnalysis,
  applyIntegration,
  deferQuestion,
  formatAnswer,
  InterviewError,
  integrateAnswers,
  isSuspiciousShrink,
  revertIntegration,
} from './interview'

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-01T10:00:00.000Z')
const NOW_ISO = NOW.toISOString()
const CREATED = '2026-01-01T00:00:00.000Z'

/** Deterministische IDs: q1, q2, … */
const idFactory = () => {
  let n = 0
  return () => `q${++n}`
}

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

const answeredText = (text: string): Partial<Question> => ({
  status: 'answered',
  answer: { kind: 'text', text },
  answeredAt: CREATED,
})

function projectWith(questions: Question[], log: InterviewLogEntry[] = []): Project {
  const base = makeProject()
  return { ...base, interview: { questions, log, analysis: null } }
}

/** Setzt Inhalt und Reife eines Abschnitts. */
function withSection(project: Project, id: SectionId, patch: Partial<Section>): Project {
  const sections = { ...project.blueprint.sections }
  sections[id] = { ...sections[id], ...patch }
  return { ...project, blueprint: { sections } }
}

function withMaturityOnly(project: Project, id: SectionId, maturity: Maturity): Project {
  return withSection(project, id, { maturity })
}

function expectValid(project: unknown) {
  expect(() => projectSchema.parse(project)).not.toThrow()
}

function candidate(overrides: Partial<QuestionCandidate> = {}): QuestionCandidate {
  return {
    key: 'a',
    sectionId: 'techStack',
    text: 'Welche Plattform nutzen wir?',
    why: 'Bestimmt den Stack.',
    leverage: 4,
    options: ['Web', 'Mobile'],
    dependsOn: [],
    ...overrides,
  }
}

function analysis(
  questions: QuestionCandidate[],
  overrides: Partial<BlueprintAnalysisResult> = {},
): BlueprintAnalysisResult {
  return {
    summary: 'Stand: Idee.',
    gaps: [],
    contradictions: [],
    questions,
    ...overrides,
  }
}

function runAnalysis(
  project: Project,
  result: BlueprintAnalysisResult,
  options: { promptVersion?: number } = {},
): Project {
  return applyAnalysis(project, result, { now: NOW, createId: idFactory(), ...options })
}

// ---------------------------------------------------------------------------
// applyAnalysis
// ---------------------------------------------------------------------------

describe('applyAnalysis – bestehende Fragen', () => {
  it('überholt offene Fragen (dismissed)', () => {
    const project = projectWith([question('old', 'techStack')])
    const result = runAnalysis(project, analysis([candidate()]))

    expect(result.interview.questions.find((q) => q.id === 'old')?.status).toBe('dismissed')
    expectValid(result)
  })

  it('lässt beantwortete und zurückgestellte Fragen unverändert', () => {
    const answered = question('ans', 'techStack', answeredText('Web'))
    const deferred = question('def', 'audience', { status: 'deferred' })
    const result = runAnalysis(projectWith([answered, deferred]), analysis([candidate()]))

    expect(result.interview.questions.slice(0, 2)).toEqual([answered, deferred])
  })

  it('stellt eine zuvor überholte Frage mit gleichem Text erneut als neue Frage', () => {
    const old = question('old', 'techStack', { text: 'Welche Plattform nutzen wir?' })
    const result = runAnalysis(projectWith([old]), analysis([candidate()]))

    expect(result.interview.questions).toHaveLength(2)
    expect(result.interview.questions[1]).toMatchObject({
      id: 'q1',
      text: 'Welche Plattform nutzen wir?',
      status: 'open',
    })
  })

  it('verändert das übergebene Projekt nicht', () => {
    const project = projectWith([question('old', 'techStack')])
    const before = structuredClone(project)

    runAnalysis(project, analysis([candidate()]))

    expect(project).toEqual(before)
  })
})

describe('applyAnalysis – Kandidaten filtern', () => {
  it('verwirft Kandidaten, die inhaltlich schon beantwortet oder zurückgestellt sind', () => {
    const project = projectWith([
      question('ans', 'techStack', {
        text: 'Welche Plattform nutzen wir?',
        ...answeredText('Web'),
      }),
      question('def', 'audience', { status: 'deferred', text: 'Wer ist die Zielgruppe?' }),
    ])
    const result = runAnalysis(
      project,
      analysis([
        candidate({ text: '  welche   PLATTFORM nutzen wir? ' }),
        candidate({ text: 'wer ist  die zielgruppe?' }),
        candidate({ text: 'Was ist der MVP?' }),
      ]),
    )
    const added = result.interview.questions.filter((q) => q.status === 'open')

    expect(added.map((q) => q.text)).toEqual(['Was ist der MVP?'])
  })

  it('verwirft doppelte Kandidaten innerhalb derselben Analyse', () => {
    const result = runAnalysis(
      projectWith([]),
      analysis([candidate({ text: 'Frage A?' }), candidate({ text: 'frage  a?' })]),
    )

    expect(result.interview.questions).toHaveLength(1)
  })

  it.each(['', '   ', '\n\t '])('verwirft Kandidaten mit leerem Text (%j)', (text) => {
    const result = runAnalysis(projectWith([]), analysis([candidate({ text })]))

    expect(result.interview.questions).toEqual([])
  })

  it(`übernimmt höchstens ${MAX_ANALYSIS_QUESTIONS} Fragen, in Reihenfolge der Kandidaten`, () => {
    const candidates = Array.from({ length: MAX_ANALYSIS_QUESTIONS + 2 }, (_, i) =>
      candidate({ key: `k${i}`, text: `Frage ${i + 1}?` }),
    )
    const result = runAnalysis(projectWith([]), analysis(candidates))

    expect(result.interview.questions).toHaveLength(MAX_ANALYSIS_QUESTIONS)
    expect(result.interview.questions.at(-1)?.text).toBe(`Frage ${MAX_ANALYSIS_QUESTIONS}?`)
  })
})

describe('applyAnalysis – Hebel', () => {
  it.each([
    [0, 1],
    [1, 1],
    [2.4, 2],
    [2.5, 3],
    [4.6, 5],
    [5, 5],
    [9, 5],
    [-3, 1],
    [NaN, 3],
  ])('Hebel %s wird zu %i', (leverage, expected) => {
    const result = runAnalysis(projectWith([]), analysis([candidate({ leverage })]))

    expect(result.interview.questions[0]?.leverage).toBe(expected)
  })
})

describe('applyAnalysis – Antwortoptionen', () => {
  it.each([
    {
      name: 'leere und doppelte Optionen fallen weg',
      options: ['Web', '  ', 'web ', 'Mobile'],
      expected: ['Web', 'Mobile'],
    },
    { name: 'eine einzelne Option ist keine Auswahl', options: ['Nur eine'], expected: [] },
    { name: 'nach dem Bereinigen bleibt nur eine Option', options: ['Web', 'WEB'], expected: [] },
    { name: 'keine Optionen', options: [], expected: [] },
    {
      name: 'höchstens vier Optionen',
      options: ['A', 'B', 'C', 'D', 'E', 'F'],
      expected: ['A', 'B', 'C', 'D'],
    },
    {
      name: 'Leerzeichen werden entfernt',
      options: ['  Web  ', 'Mobile'],
      expected: ['Web', 'Mobile'],
    },
  ])('$name', ({ options, expected }) => {
    const result = runAnalysis(projectWith([]), analysis([candidate({ options })]))

    expect(result.interview.questions[0]?.options.map((o) => o.label)).toEqual(expected)
  })

  it('vergibt Options-IDs nach dem Muster <Frage-ID>-o<Nummer>', () => {
    const result = runAnalysis(
      projectWith([]),
      analysis([candidate({ options: ['Web', '', 'Mobile'] })]),
    )

    expect(result.interview.questions[0]?.options).toEqual([
      { id: 'q1-o1', label: 'Web' },
      { id: 'q1-o2', label: 'Mobile' },
    ])
  })
})

describe('applyAnalysis – Abhängigkeiten', () => {
  it('bildet Schlüssel auf Frage-IDs ab, auch bei Vorwärtsverweisen', () => {
    const result = runAnalysis(
      projectWith([]),
      analysis([
        candidate({ key: 'a', text: 'A?', dependsOn: ['b'] }),
        candidate({ key: 'b', text: 'B?', dependsOn: [] }),
      ]),
    )
    const [a, b] = result.interview.questions

    expect(a?.dependsOn).toEqual(['q2'])
    expect(b?.dependsOn).toEqual([])
  })

  it.each([
    { name: 'unbekannter Schlüssel', dependsOn: ['zzz'], expected: [] },
    { name: 'Selbstbezug', dependsOn: ['a'], expected: [] },
    { name: 'doppelter Schlüssel zählt einmal', dependsOn: ['b', 'b'], expected: ['q2'] },
    { name: 'Schlüssel wird getrimmt', dependsOn: [' b '], expected: ['q2'] },
  ])('$name', ({ dependsOn, expected }) => {
    const result = runAnalysis(
      projectWith([]),
      analysis([
        candidate({ key: 'a', text: 'A?', dependsOn }),
        candidate({ key: 'b', text: 'B?' }),
      ]),
    )

    expect(result.interview.questions[0]?.dependsOn).toEqual(expected)
  })

  it('bricht einen Kreis, indem die schließende Kante entfällt', () => {
    const result = runAnalysis(
      projectWith([]),
      analysis([
        candidate({ key: 'a', text: 'A?', dependsOn: ['b'] }),
        candidate({ key: 'b', text: 'B?', dependsOn: ['a'] }),
      ]),
    )
    const [a, b] = result.interview.questions

    expect(a?.dependsOn).toEqual(['q2'])
    expect(b?.dependsOn).toEqual([])
  })

  it('verwendet bei doppeltem oder leerem Schlüssel nur die erste Frage', () => {
    const result = runAnalysis(
      projectWith([]),
      analysis([
        candidate({ key: 'x', text: 'A?' }),
        candidate({ key: 'x', text: 'B?' }),
        candidate({ key: '', text: 'Ohne Schlüssel?' }),
        candidate({ key: 'c', text: 'C?', dependsOn: ['x'] }),
      ]),
    )
    const [, , , c] = result.interview.questions

    expect(c?.dependsOn).toEqual(['q1'])
  })

  it('behält Abhängigkeiten in einem Diamanten ohne Kreis', () => {
    // a → b, a → c, b → e, c → e; z → a ist kein Kreis und bleibt erhalten.
    const result = runAnalysis(
      projectWith([]),
      analysis([
        candidate({ key: 'a', text: 'A?', dependsOn: ['b', 'c'] }),
        candidate({ key: 'b', text: 'B?', dependsOn: ['e'] }),
        candidate({ key: 'c', text: 'C?', dependsOn: ['e'] }),
        candidate({ key: 'e', text: 'E?' }),
        candidate({ key: 'z', text: 'Z?', dependsOn: ['a'] }),
      ]),
    )
    const dependsOn = result.interview.questions.map((q) => q.dependsOn)

    expect(dependsOn).toEqual([['q2', 'q3'], ['q4'], ['q4'], [], ['q1']])
  })

  it('bricht auch längere Kreise', () => {
    const result = runAnalysis(
      projectWith([]),
      analysis([
        candidate({ key: 'a', text: 'A?', dependsOn: ['b'] }),
        candidate({ key: 'b', text: 'B?', dependsOn: ['c'] }),
        candidate({ key: 'c', text: 'C?', dependsOn: ['a'] }),
      ]),
    )
    const [a, b, c] = result.interview.questions

    expect(a?.dependsOn).toEqual(['q2'])
    expect(b?.dependsOn).toEqual(['q3'])
    expect(c?.dependsOn).toEqual([])
  })
})

describe('applyAnalysis – Ergebnis', () => {
  it('übernimmt Felder der neuen Frage mit Zeitstempel und offenem Status', () => {
    const result = runAnalysis(
      projectWith([]),
      analysis([candidate({ text: '  Welche Plattform nutzen wir?  ', why: ' Stack ' })]),
    )

    expect(result.interview.questions).toEqual([
      {
        id: 'q1',
        sectionId: 'techStack',
        text: 'Welche Plattform nutzen wir?',
        why: 'Stack',
        leverage: 4,
        options: [
          { id: 'q1-o1', label: 'Web' },
          { id: 'q1-o2', label: 'Mobile' },
        ],
        dependsOn: [],
        status: 'open',
        answer: null,
        createdAt: NOW_ISO,
        answeredAt: null,
      },
    ])
    expectValid(result)
  })

  it('speichert die Analyse mit getrimmter Zusammenfassung, bereinigten Befunden und Version', () => {
    const result = runAnalysis(
      projectWith([]),
      analysis([], {
        summary: '  Kurz.  ',
        gaps: [
          { sectionIds: ['problem', 'problem'], text: '  Zielgruppe fehlt  ' },
          { sectionIds: ['features'], text: '   ' },
        ],
        contradictions: [{ sectionIds: ['nonGoals', 'flows'], text: 'Widerspruch' }],
      }),
    )

    expect(result.interview.analysis).toEqual({
      summary: 'Kurz.',
      gaps: [{ sectionIds: ['problem'], text: 'Zielgruppe fehlt' }],
      contradictions: [{ sectionIds: ['nonGoals', 'flows'], text: 'Widerspruch' }],
      analyzedAt: NOW_ISO,
      promptVersion: ANALYZE_BLUEPRINT_PROMPT_VERSION,
    })
    expectValid(result)
  })

  it('vergibt ohne createId zufällige UUIDs', () => {
    const result = applyAnalysis(projectWith([]), analysis([candidate()]), { now: NOW })
    const [added] = result.interview.questions

    expect(added?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('übernimmt eine angegebene Prompt-Version', () => {
    const result = runAnalysis(projectWith([]), analysis([]), { promptVersion: 7 })

    expect(result.interview.analysis?.promptVersion).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// answerQuestion / deferQuestion / formatAnswer
// ---------------------------------------------------------------------------

const platformQuestion = () =>
  question('p', 'techStack', {
    text: 'Welche Plattform?',
    options: [
      { id: 'o1', label: 'Web' },
      { id: 'o2', label: 'Mobile' },
    ],
  })

describe('answerQuestion', () => {
  it('beantwortet mit Option und Ergänzung und schreibt den Verlauf', () => {
    const project = projectWith([platformQuestion()])
    const result = answerQuestion(
      project,
      'p',
      { kind: 'option', optionId: 'o1', note: '  Browser-basiert  ' },
      NOW,
    )
    const answered = result.interview.questions[0]

    expect(answered).toMatchObject({
      status: 'answered',
      answer: { kind: 'option', optionId: 'o1', note: 'Browser-basiert' },
      answeredAt: NOW_ISO,
    })
    expect(result.interview.log).toEqual([
      {
        questionId: 'p',
        questionText: 'Welche Plattform?',
        sectionId: 'techStack',
        action: 'answered',
        answerText: 'Web – Browser-basiert',
        at: NOW_ISO,
      },
    ])
    expectValid(result)
  })

  it('schreibt bei Option ohne Ergänzung nur die Option in den Verlauf', () => {
    const result = answerQuestion(
      projectWith([platformQuestion()]),
      'p',
      { kind: 'option', optionId: 'o2', note: '   ' },
      NOW,
    )

    expect(result.interview.log[0]?.answerText).toBe('Mobile')
  })

  it('übernimmt Freitext getrimmt', () => {
    const result = answerQuestion(
      projectWith([question('t', 'techStack')]),
      't',
      { kind: 'text', text: '  Mit Next.js  ' },
      NOW,
    )

    expect(result.interview.questions[0]?.answer).toEqual({ kind: 'text', text: 'Mit Next.js' })
    expect(result.interview.log[0]?.answerText).toBe('Mit Next.js')
  })

  it('hängt an bestehenden Verlauf an', () => {
    const earlier: InterviewLogEntry = {
      questionId: 'old',
      questionText: 'Alt?',
      sectionId: 'problem',
      action: 'answered',
      answerText: 'alt',
      at: CREATED,
    }
    const result = answerQuestion(
      projectWith([platformQuestion()], [earlier]),
      'p',
      { kind: 'text', text: 'Web' },
      NOW,
    )

    expect(result.interview.log).toHaveLength(2)
    expect(result.interview.log[0]).toEqual(earlier)
  })

  it('beantwortet eine zurückgestellte Frage', () => {
    const deferred = question('d', 'techStack', { status: 'deferred' })
    const result = answerQuestion(projectWith([deferred]), 'd', { kind: 'text', text: 'Web' }, NOW)

    expect(result.interview.questions[0]?.status).toBe('answered')
    expect(result.interview.log[0]?.action).toBe('answered')
  })

  it('lässt andere Fragen und das Original unverändert', () => {
    const other = question('other', 'audience')
    const project = projectWith([platformQuestion(), other])
    const before = structuredClone(project)
    const result = answerQuestion(project, 'p', { kind: 'text', text: 'Web' }, NOW)

    expect(result.interview.questions[1]).toEqual(other)
    expect(project).toEqual(before)
  })

  it.each([
    {
      name: 'unbekannte Frage',
      questions: [platformQuestion()],
      id: 'nope',
      answer: { kind: 'text', text: 'x' } as QuestionAnswer,
      message: 'Unbekannte Frage: nope',
    },
    {
      name: 'bereits beantwortete Frage',
      questions: [question('p', 'techStack', answeredText('alt'))],
      id: 'p',
      answer: { kind: 'text', text: 'neu' } as QuestionAnswer,
      message: 'Frage p ist nicht mehr offen (answered)',
    },
    {
      name: 'überholte Frage',
      questions: [question('p', 'techStack', { status: 'dismissed' })],
      id: 'p',
      answer: { kind: 'text', text: 'x' } as QuestionAnswer,
      message: 'Frage p ist nicht mehr offen (dismissed)',
    },
    {
      name: 'leerer Freitext',
      questions: [platformQuestion()],
      id: 'p',
      answer: { kind: 'text', text: '   ' } as QuestionAnswer,
      message: 'Die Antwort ist leer',
    },
    {
      name: 'unbekannte Option',
      questions: [platformQuestion()],
      id: 'p',
      answer: { kind: 'option', optionId: 'zzz', note: '' } as QuestionAnswer,
      message: 'Unbekannte Option: zzz',
    },
  ])('lehnt ab: $name', ({ questions, id, answer, message }) => {
    expect(() => answerQuestion(projectWith(questions), id, answer, NOW)).toThrow(InterviewError)
    expect(() => answerQuestion(projectWith(questions), id, answer, NOW)).toThrow(message)
  })
})

describe('deferQuestion', () => {
  it('stellt eine offene Frage zurück und protokolliert es ohne Antworttext', () => {
    const result = deferQuestion(projectWith([platformQuestion()]), 'p', NOW)

    expect(result.interview.questions[0]).toMatchObject({
      status: 'deferred',
      answer: null,
      answeredAt: null,
    })
    expect(result.interview.log).toEqual([
      {
        questionId: 'p',
        questionText: 'Welche Plattform?',
        sectionId: 'techStack',
        action: 'deferred',
        answerText: '',
        at: NOW_ISO,
      },
    ])
    expectValid(result)
  })

  it('lässt andere Fragen unverändert', () => {
    const other = question('other', 'audience', answeredText('Ja'))
    const result = deferQuestion(projectWith([platformQuestion(), other]), 'p', NOW)

    expect(result.interview.questions[1]).toEqual(other)
  })

  it('lehnt unbekannte und nicht mehr offene Fragen ab', () => {
    expect(() => deferQuestion(projectWith([]), 'nope', NOW)).toThrow('Unbekannte Frage: nope')
    expect(() =>
      deferQuestion(projectWith([question('p', 'techStack', answeredText('x'))]), 'p', NOW),
    ).toThrow(InterviewError)
  })
})

describe('formatAnswer', () => {
  const options = [
    { id: 'o1', label: 'Web' },
    { id: 'o2', label: 'Mobile' },
  ]

  it('liefert Freitext getrimmt', () => {
    expect(formatAnswer({ options: [] }, { kind: 'text', text: '  Freitext  ' })).toBe('Freitext')
  })

  it('liefert das Optionslabel ohne Ergänzung', () => {
    expect(formatAnswer({ options }, { kind: 'option', optionId: 'o2', note: '' })).toBe('Mobile')
  })

  it('hängt eine Ergänzung mit Gedankenstrich an', () => {
    expect(formatAnswer({ options }, { kind: 'option', optionId: 'o1', note: 'Browser' })).toBe(
      'Web – Browser',
    )
  })

  it('ignoriert eine Ergänzung, die nur aus Leerzeichen besteht', () => {
    expect(formatAnswer({ options }, { kind: 'option', optionId: 'o1', note: '  ' })).toBe('Web')
  })

  it('nimmt die Options-ID, wenn die Option unbekannt ist', () => {
    expect(formatAnswer({ options }, { kind: 'option', optionId: 'zzz', note: '' })).toBe('zzz')
  })
})

// ---------------------------------------------------------------------------
// integrateAnswers / applyIntegration (mit MockAiProvider)
// ---------------------------------------------------------------------------

const FEATURES = '- Gewohnheiten anlegen\n- Täglich abhaken\n- Streak-Anzeige'

/** Projekt mit zwei beantworteten Fragen (features, audience), einer offenen (risks) und Abschnitten. */
function integrationProject(): Project {
  const base = projectWith([
    question('f1', 'features', answeredText('Täglich abhaken')),
    question('z1', 'audience', {
      status: 'answered',
      options: [
        { id: 'o1', label: 'Einzelpersonen' },
        { id: 'o2', label: 'Teams' },
      ],
      answer: { kind: 'option', optionId: 'o1', note: 'Für mich' },
      answeredAt: CREATED,
    }),
    question('r1', 'risks'),
  ])
  return withSection(
    withSection(withMaturityOnly(base, 'problem', 'vague'), 'features', {
      content: FEATURES,
      maturity: 'vague',
    }),
    'risks',
    { content: 'Datenschutz offen', maturity: 'decided' },
  )
}

const integrationResponse = (sections: { id: string; content: string; maturity: string }[]) =>
  JSON.stringify({ sections })

describe('integrateAnswers – ohne KI-Aufruf', () => {
  it('ruft die KI nicht auf, wenn keine beantwortete Frage übergeben wird', async () => {
    const provider = new MockAiProvider()
    const result = await integrateAnswers({
      provider,
      project: integrationProject(),
      questionIds: ['r1', 'unbekannt'],
      language: 'de',
    })

    expect(provider.requests).toHaveLength(0)
    expect(result).toMatchObject({ proposals: [], calls: [] })
  })

  it('liefert Prompt-ID und Version auch ohne Aufruf', async () => {
    const result = await integrateAnswers({
      provider: new MockAiProvider(),
      project: integrationProject(),
      questionIds: [],
      language: 'de',
    })

    expect(result.promptId).toBe(INTEGRATE_ANSWERS_PROMPT_ID)
    expect(result.promptVersion).toBe(INTEGRATE_ANSWERS_PROMPT_VERSION)
  })
})

describe('integrateAnswers – Anfrage', () => {
  it('schickt nur die betroffenen Abschnitte und Antworten an die KI', async () => {
    const provider = new MockAiProvider([integrationResponse([])])
    await integrateAnswers({
      provider,
      project: integrationProject(),
      questionIds: ['f1', 'z1'],
      language: 'de',
    })
    const [request] = provider.requests
    const user = request?.messages.find((m) => m.role === 'user')?.content ?? ''

    expect(user).toContain('## features')
    expect(user).toContain('## audience')
    expect(user).not.toContain('## risks')
    expect(user).not.toContain('## problem')
    expect(user).toContain('Täglich abhaken')
    expect(user).toContain('Einzelpersonen – Für mich')
    expect(request?.jsonSchema?.name).toBe('answer_integration')
    expect(request?.temperature).toBe(0.2)
  })

  it('übernimmt die Temperatur aus den Optionen', async () => {
    const provider = new MockAiProvider([integrationResponse([])])
    await integrateAnswers({
      provider,
      project: integrationProject(),
      questionIds: ['f1'],
      language: 'de',
      temperature: 0.9,
    })

    expect(provider.requests[0]?.temperature).toBe(0.9)
  })

  it('liefert Prompt-ID, Version und einen Aufruf', async () => {
    const provider = new MockAiProvider([integrationResponse([])])
    const result = await integrateAnswers({
      provider,
      project: integrationProject(),
      questionIds: ['f1'],
      language: 'de',
    })

    expect(result.calls).toHaveLength(1)
    expect(result.promptId).toBe(INTEGRATE_ANSWERS_PROMPT_ID)
    expect(result.promptVersion).toBe(INTEGRATE_ANSWERS_PROMPT_VERSION)
  })

  it('bricht ab, wenn das Signal schon abgebrochen ist', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      integrateAnswers({
        provider: new MockAiProvider([integrationResponse([])]),
        project: integrationProject(),
        questionIds: ['f1'],
        language: 'de',
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'aborted' })
  })

  it('reicht Fehler des Anbieters weiter', async () => {
    const provider = new MockAiProvider([new AiError('rateLimited', 'zu viele Anfragen')])

    await expect(
      integrateAnswers({
        provider,
        project: integrationProject(),
        questionIds: ['f1'],
        language: 'de',
      }),
    ).rejects.toMatchObject({ code: 'rateLimited' })
  })

  it('meldet eine zweimal ungültige Antwort als invalidResponse', async () => {
    const provider = new MockAiProvider(['kein JSON', 'auch kein JSON'])

    await expect(
      integrateAnswers({
        provider,
        project: integrationProject(),
        questionIds: ['f1'],
        language: 'de',
      }),
    ).rejects.toMatchObject({ code: 'invalidResponse' })
  })
})

describe('integrateAnswers – Vorschläge', () => {
  const run = (sections: { id: string; content: string; maturity: string }[]) =>
    integrateAnswers({
      provider: new MockAiProvider([integrationResponse(sections)]),
      project: integrationProject(),
      questionIds: ['f1', 'z1'],
      language: 'de',
    })

  it('übernimmt einen gültigen Vorschlag mit Reifegrad', async () => {
    const { proposals } = await run([
      { id: 'features', content: `${FEATURES}\n- Erinnerung`, maturity: 'decided' },
    ])

    expect(proposals).toEqual([
      {
        sectionId: 'features',
        before: FEATURES,
        after: `${FEATURES}\n- Erinnerung`,
        maturity: 'decided',
        beforeMaturity: 'vague',
        beforeSource: 'user',
        shrinkWarning: false,
      },
    ])
  })

  it('merkt sich Reifegrad und Quelle des Abschnitts vor dem Einarbeiten', async () => {
    const project = withSection(integrationProject(), 'features', {
      maturity: 'decided',
      source: 'aiSuggestion',
    })
    const { proposals } = await integrateAnswers({
      provider: new MockAiProvider([
        integrationResponse([
          { id: 'features', content: `${FEATURES}\n- Erinnerung`, maturity: 'vague' },
        ]),
      ]),
      project,
      questionIds: ['f1'],
      language: 'de',
    })

    expect(proposals[0]).toMatchObject({
      beforeMaturity: 'decided',
      beforeSource: 'aiSuggestion',
      maturity: 'vague',
    })
  })

  it('verwirft Abschnitte, die nicht betroffen sind', async () => {
    const { proposals } = await run([
      { id: 'risks', content: 'Neuer Text, der nicht erlaubt ist.', maturity: 'decided' },
      { id: 'problem', content: 'Auch nicht erlaubt.', maturity: 'vague' },
    ])

    expect(proposals).toEqual([])
  })

  it('verwirft leere Vorschläge', async () => {
    const { proposals } = await run([{ id: 'features', content: '  \n ', maturity: 'vague' }])

    expect(proposals).toEqual([])
  })

  it('verwirft Vorschläge, die dem bisherigen Inhalt entsprechen (ohne Randleerzeichen)', async () => {
    const { proposals } = await run([
      { id: 'features', content: `  ${FEATURES}  `, maturity: 'vague' },
    ])

    expect(proposals).toEqual([])
  })

  it('behält bei doppelten Vorschlägen nur den ersten', async () => {
    const { proposals } = await run([
      { id: 'audience', content: 'Erster Vorschlag', maturity: 'vague' },
      { id: 'audience', content: 'Zweiter Vorschlag', maturity: 'decided' },
    ])

    expect(proposals.map((p) => p.after)).toEqual(['Erster Vorschlag'])
  })

  it('macht aus dem Reifegrad „empty“ ein „vague“', async () => {
    const { proposals } = await run([
      { id: 'audience', content: 'Einzelpersonen für mich', maturity: 'empty' },
    ])

    expect(proposals[0]?.maturity).toBe('vague')
  })

  it('warnt bei stark geschrumpftem Text', async () => {
    const { proposals } = await run([
      { id: 'features', content: '- Gewohnheiten anlegen', maturity: 'vague' },
    ])

    expect(proposals[0]).toMatchObject({ before: FEATURES, shrinkWarning: true })
  })
})

describe('applyIntegration', () => {
  const proposal = {
    sectionId: 'features' as const,
    after: `${FEATURES}\n- Erinnerung`,
    maturity: 'decided' as const,
  }

  it('übernimmt Inhalt und Reife mit Quelle „aiAccepted“', () => {
    const result = applyIntegration(integrationProject(), [proposal])
    const features = result.blueprint.sections.features

    expect(features).toEqual({
      id: 'features',
      content: `${FEATURES}\n- Erinnerung`,
      maturity: 'decided',
      source: 'aiAccepted',
    })
    expectValid(result)
  })

  it('lässt alle anderen Abschnitte und Fragen unverändert (kein Datenverlust)', () => {
    const project = integrationProject()
    const result = applyIntegration(project, [proposal])

    expect(result.blueprint.sections.risks).toBe(project.blueprint.sections.risks)
    expect(result.blueprint.sections.problem).toBe(project.blueprint.sections.problem)
    expect(result.blueprint.sections.audience).toBe(project.blueprint.sections.audience)
    expect(result.interview).toEqual(project.interview)
  })

  it('wendet mehrere Vorschläge nacheinander an', () => {
    const result = applyIntegration(integrationProject(), [
      proposal,
      { sectionId: 'audience', after: 'Einzelpersonen', maturity: 'vague' },
    ])

    expect(result.blueprint.sections.audience).toMatchObject({
      content: 'Einzelpersonen',
      maturity: 'vague',
      source: 'aiAccepted',
    })
    expect(result.blueprint.sections.features.content).toBe(`${FEATURES}\n- Erinnerung`)
  })

  it('verändert nichts ohne Vorschläge', () => {
    const project = integrationProject()

    expect(applyIntegration(project, [])).toEqual(project)
  })
})

describe('revertIntegration', () => {
  /** Vorschlag wie ihn `integrateAnswers` für den Abschnitt „features“ liefert. */
  const featuresProposal = {
    sectionId: 'features' as const,
    before: FEATURES,
    after: `${FEATURES}\n- Erinnerung`,
    maturity: 'decided' as const,
    beforeMaturity: 'vague' as const,
    beforeSource: 'user' as const,
  }

  it('stellt Inhalt, Reife und Quelle des Abschnitts wieder her', () => {
    const project = integrationProject()
    const applied = applyIntegration(project, [featuresProposal])

    const result = revertIntegration(applied, [featuresProposal])

    expect(result.blueprint.sections.features).toEqual(project.blueprint.sections.features)
    expectValid(result)
  })

  it('stellt einen zuvor leeren Abschnitt wieder leer her', () => {
    const project = integrationProject()
    const proposal = {
      sectionId: 'audience' as const,
      before: '',
      after: 'Einzelpersonen für mich',
      maturity: 'vague' as const,
      beforeMaturity: 'empty' as const,
      beforeSource: 'user' as const,
    }
    const applied = applyIntegration(project, [proposal])

    const result = revertIntegration(applied, [proposal])

    expect(result.blueprint.sections.audience).toEqual({
      id: 'audience',
      content: '',
      maturity: 'empty',
      source: 'user',
    })
    expectValid(result)
  })

  it('lässt einen Abschnitt unverändert, der seit dem Einarbeiten anders bearbeitet wurde', () => {
    const applied = applyIntegration(integrationProject(), [featuresProposal])
    const edited = updateSection(applied, 'features', { content: 'Eigene Änderung' })

    const result = revertIntegration(edited, [featuresProposal])

    expect(result.blueprint.sections.features.content).toBe('Eigene Änderung')
    expect(result.blueprint.sections.features).toEqual(edited.blueprint.sections.features)
  })

  it('stellt nur die übergebenen Abschnitte wieder her und lässt andere unberührt', () => {
    const project = integrationProject()
    const audienceProposal = {
      sectionId: 'audience' as const,
      before: '',
      after: 'Einzelpersonen',
      maturity: 'vague' as const,
      beforeMaturity: 'empty' as const,
      beforeSource: 'user' as const,
    }
    const applied = applyIntegration(project, [featuresProposal, audienceProposal])

    const result = revertIntegration(applied, [featuresProposal])

    expect(result.blueprint.sections.features).toEqual(project.blueprint.sections.features)
    expect(result.blueprint.sections.audience).toEqual(applied.blueprint.sections.audience)
    expect(result.blueprint.sections.risks).toBe(project.blueprint.sections.risks)
    expect(result.interview).toEqual(project.interview)
  })

  it('nimmt mehrere Übernahmen gemeinsam zurück', () => {
    const project = integrationProject()
    const audienceProposal = {
      sectionId: 'audience' as const,
      before: '',
      after: 'Einzelpersonen',
      maturity: 'vague' as const,
      beforeMaturity: 'empty' as const,
      beforeSource: 'user' as const,
    }
    const applied = applyIntegration(project, [featuresProposal, audienceProposal])

    const result = revertIntegration(applied, [featuresProposal, audienceProposal])

    expect(result.blueprint).toEqual(project.blueprint)
    expectValid(result)
  })

  it('verändert nichts ohne Vorschläge', () => {
    const project = integrationProject()

    expect(revertIntegration(project, [])).toEqual(project)
  })
})

// ---------------------------------------------------------------------------
// appendAnswersToSections (ohne KI)
// ---------------------------------------------------------------------------

describe('appendAnswersToSections', () => {
  const textAnswer = (id: string, sectionId: SectionId, text_: string, text: string) =>
    question(id, sectionId, { text: text_, ...answeredText(text) })

  it.each([
    {
      name: 'Fragezeichen: Leerzeichen',
      question: 'Welche Plattform?',
      expected: '- Welche Plattform? Web',
    },
    { name: 'ohne Satzzeichen: Doppelpunkt', question: 'Plattform', expected: '- Plattform: Web' },
    {
      name: 'Doppelpunkt am Ende: Leerzeichen',
      question: 'Plattform:',
      expected: '- Plattform: Web',
    },
  ])('Trennzeichen bei $name', ({ question: text, expected }) => {
    const project = projectWith([textAnswer('p', 'techStack', text, 'Web')])
    const result = appendAnswersToSections(project, ['p'])

    expect(result.blueprint.sections.techStack.content).toBe(expected)
  })

  it('hängt an bestehenden Inhalt an, ohne ihn zu verändern', () => {
    const project = withSection(
      projectWith([textAnswer('f', 'features', 'Welche Funktionen sind Pflicht?', 'Login')]),
      'features',
      { content: FEATURES, maturity: 'vague', source: 'user' },
    )
    const result = appendAnswersToSections(project, ['f'])
    const content = result.blueprint.sections.features.content

    expect(content).toBe(`${FEATURES}\n- Welche Funktionen sind Pflicht? Login`)
    expect(content.startsWith(FEATURES)).toBe(true)
    expect(result.blueprint.sections.features.source).toBe('user')
    expectValid(result)
  })

  it('setzt in einem leeren Abschnitt Quelle „user“ und Reife „vague“', () => {
    const result = appendAnswersToSections(
      projectWith([textAnswer('p', 'techStack', 'Plattform', 'Web')]),
      ['p'],
    )

    expect(result.blueprint.sections.techStack).toMatchObject({
      content: '- Plattform: Web',
      maturity: 'vague',
      source: 'user',
    })
    expectValid(result)
  })

  it('übernimmt Optionsantworten mit Ergänzung als lesbaren Text', () => {
    const project = projectWith([
      question('z', 'audience', {
        text: 'Für wen?',
        options: [{ id: 'o1', label: 'Einzelpersonen' }],
        status: 'answered',
        answer: { kind: 'option', optionId: 'o1', note: 'Für mich' },
        answeredAt: CREATED,
      }),
    ])
    const result = appendAnswersToSections(project, ['z'])

    expect(result.blueprint.sections.audience.content).toBe('- Für wen? Einzelpersonen – Für mich')
  })

  it('hängt mehrere Antworten in Reihenfolge an', () => {
    const project = projectWith([
      textAnswer('a', 'audience', 'Wer?', 'Ich'),
      textAnswer('b', 'audience', 'Wie viele?', 'Wenige'),
    ])
    const result = appendAnswersToSections(project, ['a', 'b'])

    expect(result.blueprint.sections.audience.content).toBe('- Wer? Ich\n- Wie viele? Wenige')
  })

  it('berücksichtigt nur beantwortete Fragen', () => {
    const project = projectWith([
      question('open', 'techStack', { text: 'Offen?' }),
      question('def', 'techStack', { text: 'Später?', status: 'deferred' }),
    ])
    const result = appendAnswersToSections(project, ['open', 'def'])

    expect(result).toEqual(project)
  })

  it('ändert nichts ohne Fragen-IDs', () => {
    const project = projectWith([textAnswer('p', 'techStack', 'Plattform', 'Web')])

    expect(appendAnswersToSections(project, [])).toEqual(project)
  })
})

// ---------------------------------------------------------------------------
// isSuspiciousShrink
// ---------------------------------------------------------------------------

describe('isSuspiciousShrink', () => {
  it.each([
    { name: 'knapp unter der Mindestlänge', before: 39, after: 0, expected: false },
    { name: 'Mindestlänge, neuer Text leer', before: 40, after: 0, expected: true },
    { name: 'Grenze: 40 auf 24 ist nicht verdächtig', before: 40, after: 24, expected: false },
    { name: 'Grenze: 40 auf 23 ist verdächtig', before: 40, after: 23, expected: true },
    { name: '100 auf 60 ist nicht verdächtig', before: 100, after: 60, expected: false },
    { name: '100 auf 59 ist verdächtig', before: 100, after: 59, expected: true },
    { name: 'alter Text leer ist nie verdächtig', before: 0, after: 0, expected: false },
    { name: 'neuer Text wächst', before: 50, after: 200, expected: false },
  ])('$name', ({ before, after, expected }) => {
    expect(isSuspiciousShrink('x'.repeat(before), 'y'.repeat(after))).toBe(expected)
  })

  it('zählt den alten Text ohne Randleerzeichen', () => {
    expect(isSuspiciousShrink(`   ${'x'.repeat(39)}   `, '')).toBe(false)
    expect(isSuspiciousShrink(`   ${'x'.repeat(40)}   `, 'y'.repeat(23))).toBe(true)
  })

  it('zählt den neuen Text ohne Randleerzeichen', () => {
    expect(isSuspiciousShrink('x'.repeat(40), `  ${'y'.repeat(24)}  `)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// analyzeBlueprint (mit MockAiProvider)
// ---------------------------------------------------------------------------

describe('analyzeBlueprint', () => {
  const sample = analysis([candidate({ key: 'q1' })], { summary: 'Kurzer Stand.' })
  const project = makeProject({ name: 'Wochenplaner' })

  it('fragt die KI mit dem Schema „blueprint_analysis“ und liefert das Ergebnis', async () => {
    const provider = new MockAiProvider([JSON.stringify(sample)])
    const result = await analyzeBlueprint({ provider, project, language: 'de' })
    const [request] = provider.requests

    expect(request?.jsonSchema?.name).toBe('blueprint_analysis')
    expect(request?.temperature).toBe(0.3)
    expect(request?.messages.find((m) => m.role === 'user')?.content).toContain('Wochenplaner')
    expect(result.result).toEqual(sample)
    expect(result.calls).toHaveLength(1)
    expect(result.promptId).toBe(ANALYZE_BLUEPRINT_PROMPT_ID)
    expect(result.promptVersion).toBe(ANALYZE_BLUEPRINT_PROMPT_VERSION)
  })

  it('übernimmt Temperatur und Sprache', async () => {
    const provider = new MockAiProvider([JSON.stringify(sample)])
    await analyzeBlueprint({ provider, project, language: 'en', temperature: 0.1 })
    const [request] = provider.requests

    expect(request?.temperature).toBe(0.1)
    expect(request?.messages[0]?.content).toContain('Englisch')
  })

  it('bricht ab, wenn das Signal schon abgebrochen ist', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      analyzeBlueprint({
        provider: new MockAiProvider([JSON.stringify(sample)]),
        project,
        language: 'de',
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'aborted' })
  })

  it('meldet eine zweimal ungültige Antwort als invalidResponse', async () => {
    const provider = new MockAiProvider(['{"summary": 3}', '{"summary": 3}'])

    await expect(analyzeBlueprint({ provider, project, language: 'de' })).rejects.toMatchObject({
      code: 'invalidResponse',
    })
  })
})
