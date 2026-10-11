import { blueprintAnalysisResultSchema } from '@/core/ai/prompts'
import { projectSchema, type Project, type Question } from '@/core/blueprint/schema'
import { makeProject } from '@/core/blueprint/testing'
import { answerQuestion, applyAnalysis } from './interview'
import { prioritizeQuestions, selectRound } from './prioritization'
import analysisVagueJson from './__fixtures__/analysis-vague.json'

/**
 * Abnahmetest Phase 4: Ein vager Blueprint wird mit einer realistischen KI-Antwort
 * in Runden geführt. Die erste Runde darf nur Grundsatzfragen enthalten.
 */

const NOW = new Date('2026-03-01T10:00:00.000Z')

/** Deterministische IDs: id-1, id-2, … */
const createId = (() => {
  let n = 0
  return () => `id-${++n}`
})()

/** Vager Blueprint: nur das Problem ist mit einem Satz umrissen. */
function vagueBlueprint(): Project {
  const base = makeProject({ name: 'Wochenplaner', entryPoint: 'noIdea' })
  const problem = {
    ...base.blueprint.sections.problem,
    content: 'Wochenplanung mit Rezepten kostet Zeit und endet oft ohne Einkaufsliste.',
    maturity: 'vague' as const,
  }
  return { ...base, blueprint: { sections: { ...base.blueprint.sections, problem } } }
}

function questionByText(project: Project, text: string): Question {
  const found = project.interview.questions.find((q) => q.text === text)
  if (!found) throw new Error(`Frage fehlt: ${text}`)
  return found
}

const AUDIENCE = 'Für wen ist die App gedacht?'
const PLATFORM = 'Auf welcher Plattform soll die App laufen?'
const MVP = 'Was gehört zum MVP, also zur ersten Version?'
const DETAILS = [
  'Welche Datenbank soll die Rezepte speichern?',
  'Welches Farbschema soll die Oberfläche haben?',
  'Wie sollen sich Nutzer anmelden?',
  'Welche Meilensteine planen wir zuerst?',
]

/** Die KI-Antwort aus der Fixture, geprüft gegen das Schema, und daraus das Projekt. */
function analyzedProject(): Project {
  const result = blueprintAnalysisResultSchema.parse(analysisVagueJson)
  return applyAnalysis(vagueBlueprint(), result, { now: NOW, createId })
}

describe('Abnahme Phase 4: vager Blueprint', () => {
  it('die KI-Antwort ist gültig und wird vollständig übernommen', () => {
    const project = analyzedProject()

    expect(() => projectSchema.parse(project)).not.toThrow()
    expect(project.interview.questions.map((q) => q.text)).toEqual(
      analysisVagueJson.questions.map((q) => q.text),
    )
  })

  it('die erste Runde enthält nur Grundsatzfragen, Plattform und Zielgruppe', () => {
    const round = selectRound(analyzedProject())

    expect(round.map((q) => q.text)).toEqual([AUDIENCE, PLATFORM])
    expect(round.every((q) => q.leverage === 5)).toBe(true)
  })

  it('keine Detailfrage landet in der ersten Runde', () => {
    const round = selectRound(analyzedProject()).map((q) => q.text)

    for (const detail of DETAILS) expect(round).not.toContain(detail)
  })

  it('der MVP-Umfang wartet auf die Zielgruppe', () => {
    const project = analyzedProject()
    const mvp = questionByText(project, MVP)
    const { blocked } = prioritizeQuestions(project)
    const entry = blocked.find((r) => r.question.id === mvp.id)

    expect(entry?.reason).toEqual({
      kind: 'dependency',
      questionIds: [questionByText(project, AUDIENCE).id],
    })
    expect(selectRound(project).map((q) => q.text)).not.toContain(MVP)
  })

  it('die Detailfragen sind wegen des leeren MVP-Abschnitts zurückgestellt', () => {
    const { blocked } = prioritizeQuestions(analyzedProject())

    for (const detail of DETAILS) {
      const entry = blocked.find((r) => r.question.text === detail)
      expect(entry?.reason.kind, detail).toBe('section')
    }
  })

  it('nach der Antwort zur Zielgruppe kommt der MVP-Umfang in die nächste Runde', () => {
    const project = analyzedProject()
    const answered = answerQuestion(
      project,
      questionByText(project, AUDIENCE).id,
      { kind: 'text', text: 'Zuerst nur für mich, später vielleicht für die Familie.' },
      NOW,
    )

    expect(() => projectSchema.parse(answered)).not.toThrow()
    expect(selectRound(answered).map((q) => q.text)).toEqual([MVP, PLATFORM])
  })

  it('nach der Zielgruppe bleibt die Runde bei Grundsatzfragen', () => {
    const project = analyzedProject()
    const answered = answerQuestion(
      project,
      questionByText(project, AUDIENCE).id,
      { kind: 'text', text: 'Zuerst nur für mich.' },
      NOW,
    )
    const round = selectRound(answered).map((q) => q.text)

    for (const detail of DETAILS) expect(round).not.toContain(detail)
  })
})
