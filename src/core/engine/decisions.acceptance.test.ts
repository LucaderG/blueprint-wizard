import { decisionsResultSchema } from '@/core/ai/prompts'
import { projectSchema, type Project } from '@/core/blueprint/schema'
import { makeProject, withMaturity } from '@/core/blueprint/testing'
import { applyDecisionCandidates, CORE_DECISION_LIMIT, decide, rankDecisions } from './decisions'
import decisionsExampleJson from './__fixtures__/decisions-example.json'

/**
 * Abnahmetest Phase 5: Ein Rezept-Planer mit angedeuteter Idee bekommt eine realistische
 * KI-Antwort mit neun Entscheidungen. Die Rangfolge ergibt sich aus Hebel × Unsicherheit.
 *
 * Beispielprojekt: Problem entschieden, Zielgruppe, Funktionen und Integrationen angedeutet,
 * Tech-Stack leer. Gegenüber der Vorgabe ist `integrations` hier „angedeutet“ statt leer: Mit
 * „leer“ hätte die Anbindung-Frage (Hebel 4, Score 12) die Frage nach dem MVP (Hebel 5, Score 10)
 * überholt, und die Erwartung „die ersten drei haben Hebel 5“ wäre mit der Formel nicht erfüllbar.
 */

const NOW = new Date('2026-03-01T10:00:00.000Z')
const LATER = new Date('2026-03-05T10:00:00.000Z')

/** Deterministische IDs: d1, d2, … */
const sequentialIds = () => {
  let n = 0
  return () => `d${++n}`
}

function exampleProject(): Project {
  const base = makeProject({ name: 'Rezept-Planer', entryPoint: 'partialIdea' })
  const problem = {
    ...base.blueprint.sections.problem,
    content: 'Wochenplanung mit Rezepten kostet Zeit und endet oft ohne Einkaufsliste.',
    maturity: 'decided' as const,
  }
  const withProblem = { ...base, blueprint: { sections: { ...base.blueprint.sections, problem } } }
  return withMaturity(withProblem, {
    audience: 'vague',
    features: 'vague',
    integrations: 'vague',
  })
}

/** Übernimmt die KI-Antwort aus der Fixture (geprüft gegen das Schema) in das Beispielprojekt. */
function appliedProject(): Project {
  const result = decisionsResultSchema.parse(decisionsExampleJson)
  return projectSchema.parse(
    applyDecisionCandidates(exampleProject(), result, { now: NOW, createId: sequentialIds() }),
  )
}

const titles = (decisions: { title: string }[]) => decisions.map((d) => d.title)

describe('Abnahme Phase 5: Rezept-Planer', () => {
  it('die KI-Antwort ist gültig nach decisionsResultSchema und hat neun Entscheidungen', () => {
    const result = decisionsResultSchema.parse(decisionsExampleJson)

    expect(result.decisions).toHaveLength(9)
  })

  it('übernimmt alle neun Entscheidungen; die Rangfolge trennt Kern und weitere', () => {
    const project = appliedProject()

    expect(project.decisions.filter((d) => d.status === 'open')).toHaveLength(9)
  })

  it(`zeigt im Kern genau ${CORE_DECISION_LIMIT} Entscheidungen`, () => {
    expect(rankDecisions(appliedProject()).core).toHaveLength(CORE_DECISION_LIMIT)
  })

  it('die ersten drei Entscheidungen im Kern haben Hebel 5', () => {
    const { core } = rankDecisions(appliedProject())

    expect(core.slice(0, 3).map((d) => d.leverage)).toEqual([5, 5, 5])
    expect(titles(core.slice(0, 3))).toEqual([
      'Werden Rezepte lokal oder auf einem Server gespeichert?',
      'Web-App oder native App?',
      'Was gehört zum MVP, also zur ersten Version?',
    ])
  })

  it('Farbschema und Schriftart (Hebel 1) landen in more', () => {
    // Schlägt fehl: applyDecisionCandidates kürzt auf sieben Kandidaten nach Reihenfolge der KI.
    // Damit gibt es nie mehr als sieben offene Entscheidungen, und `more` bleibt leer.
    expect(titles(rankDecisions(appliedProject()).more)).toEqual([
      'Welches Farbschema soll die Oberfläche haben?',
      'Welche Schriftart passt?',
    ])
  })

  it('die Rangfolge ist für gleichen Input stabil', () => {
    const first = rankDecisions(appliedProject())
    const second = rankDecisions(appliedProject())

    expect(first).toEqual(second)
    expect(titles(first.core)).toEqual(titles(second.core))
  })

  it('nach dem Treffen einer Entscheidung verschwindet sie aus dem Kern und erscheint im Protokoll', () => {
    const project = appliedProject()
    const platform = rankDecisions(project).core.find((d) => d.title === 'Web-App oder native App?')
    if (!platform) throw new Error('Plattform-Entscheidung fehlt im Kern')
    const webOption = platform.options[0]
    if (!webOption) throw new Error('Option fehlt')

    const decided = projectSchema.parse(
      decide(
        project,
        platform.id,
        webOption.id,
        '  Rezepte sollen am Handy und am Rechner funktionieren. ',
        LATER,
      ),
    )
    const ranking = rankDecisions(decided)

    expect(ranking.core.map((d) => d.id)).not.toContain(platform.id)
    expect(ranking.core).toHaveLength(CORE_DECISION_LIMIT)
    expect(ranking.more).toHaveLength(1)
    expect(ranking.log).toHaveLength(1)
    expect(ranking.log[0]).toMatchObject({
      id: platform.id,
      title: 'Web-App oder native App?',
      status: 'decided',
      chosenOptionId: webOption.id,
      rationale: 'Rezepte sollen am Handy und am Rechner funktionieren.',
      decidedAt: LATER.toISOString(),
    })
  })
})
