import { makeProject } from '@/core/blueprint/testing'
import { applyAnalysis } from '@/core/engine'
import { applyDrafts, isAnswered } from './useInterview'

const now = new Date('2026-02-01T10:00:00.000Z')

function projectWithQuestions() {
  let n = 0
  return applyAnalysis(
    makeProject(),
    {
      summary: '',
      gaps: [],
      contradictions: [],
      questions: [
        {
          key: 'a',
          sectionId: 'audience',
          text: 'Für wen?',
          why: '',
          leverage: 5,
          options: [],
          dependsOn: [],
        },
        {
          key: 'b',
          sectionId: 'techStack',
          text: 'Plattform?',
          why: '',
          leverage: 5,
          options: ['Web', 'Mobil'],
          dependsOn: [],
        },
        {
          key: 'c',
          sectionId: 'problem',
          text: 'Welches Problem?',
          why: '',
          leverage: 5,
          options: [],
          dependsOn: [],
        },
      ],
    },
    { now, createId: () => `q${++n}` },
  )
}

describe('isAnswered', () => {
  it.each([
    [undefined, false],
    [{ kind: 'later' } as const, false],
    [{ kind: 'text', text: '  ' } as const, false],
    [{ kind: 'text', text: 'Studierende' } as const, true],
    [{ kind: 'option', optionId: 'q2-o1', note: '' } as const, true],
  ])('%j → %s', (draft, expected) => {
    expect(isAnswered(draft)).toBe(expected)
  })
})

describe('applyDrafts', () => {
  it('beantwortet, stellt zurück und lässt leere Entwürfe offen', () => {
    const { project, answeredIds } = applyDrafts(
      projectWithQuestions(),
      {
        q1: { kind: 'text', text: 'Studierende' },
        q2: { kind: 'later' },
        q3: { kind: 'text', text: '   ' },
      },
      now,
    )

    expect(answeredIds).toEqual(['q1'])
    expect(project.interview.questions.map((q) => q.status)).toEqual([
      'answered',
      'deferred',
      'open',
    ])
    expect(project.interview.log.map((e) => e.action)).toEqual(['answered', 'deferred'])
  })

  it('liefert ohne Entwürfe dasselbe Projekt zurück', () => {
    const original = projectWithQuestions()

    expect(applyDrafts(original, {}, now).project).toBe(original)
  })
})
