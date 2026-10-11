import { migrateProject } from '@/core/blueprint/migrations'
import { makeProject } from '@/core/blueprint/testing'
import projectV2 from '@/core/blueprint/__fixtures__/project-v2.json'
import { MAX_ANALYSIS_QUESTIONS } from '@/core/ai/prompts'
import { applyAdditionCandidates, acceptAddition } from './additions'
import { keepHighestLeverage } from './cleaning'
import { applyAnalysis } from './interview'

/** Regressionstests für Befunde aus der Prüfung von Phase 5. */
const now = new Date('2026-05-01T10:00:00.000Z')

describe('keepHighestLeverage', () => {
  it('behält die Einträge mit dem höchsten Hebel in ursprünglicher Reihenfolge', () => {
    const items = [1, 5, 3, 5, 2]

    expect(keepHighestLeverage(items, 3, (n) => n)).toEqual([5, 3, 5])
    expect(keepHighestLeverage(items, 10, (n) => n)).toEqual(items)
    expect(keepHighestLeverage(items, 0, (n) => n)).toEqual([])
  })
})

describe('applyAnalysis kürzt nach Hebel', () => {
  it('verwirft bei zu vielen Fragen die mit dem niedrigsten Hebel, nicht die letzten', () => {
    const questions = Array.from({ length: MAX_ANALYSIS_QUESTIONS + 1 }, (_, i) => ({
      key: `q${i}`,
      sectionId: 'problem' as const,
      text: `Frage ${i}?`,
      why: '',
      leverage: i === 0 ? 1 : 4,
      options: [],
      dependsOn: [],
    }))
    let n = 0

    const project = applyAnalysis(
      makeProject(),
      { summary: '', gaps: [], contradictions: [], questions },
      { now, createId: () => `id${++n}` },
    )

    const texts = project.interview.questions.map((q) => q.text)
    expect(texts).toHaveLength(MAX_ANALYSIS_QUESTIONS)
    expect(texts).not.toContain('Frage 0?')
    expect(texts.at(-1)).toBe(`Frage ${MAX_ANALYSIS_QUESTIONS}?`)
  })
})

describe('Vorschläge mit Aufzählungszeichen', () => {
  it('entfernt das Aufzählungszeichen der KI und erkennt so auch Dubletten', () => {
    const base = makeProject()
    const withFeature = {
      ...base,
      blueprint: {
        sections: {
          ...base.blueprint.sections,
          features: {
            ...base.blueprint.sections.features,
            content: '- Export',
            maturity: 'vague' as const,
          },
        },
      },
    }

    const next = applyAdditionCandidates(
      withFeature,
      {
        additions: [
          { sectionId: 'features', text: '- Export', reason: '' },
          { sectionId: 'features', text: '* Teilen per Link', reason: '' },
        ],
      },
      { now, createId: () => 'a1' },
    )

    expect(next.additions.map((a) => a.text)).toEqual(['Teilen per Link'])
    expect(acceptAddition(next, 'a1', now).blueprint.sections.features.content).toBe(
      '- Export\n- Teilen per Link',
    )
  })
})

describe('Migration v2 → v3 mit unbrauchbaren Altdaten', () => {
  function withOldDecisions(decisions: unknown[]) {
    const data = structuredClone(projectV2) as Record<string, unknown> & {
      blueprint: { sections: Record<string, Record<string, unknown>> }
    }
    for (const section of Object.values(data.blueprint.sections)) section.decisions = []
    const problem = data.blueprint.sections.problem
    if (problem) problem.decisions = decisions
    return data
  }

  it('verwirft Entscheidungen mit weniger als zwei Optionen, statt das Projekt zu sperren', () => {
    const project = migrateProject(
      withOldDecisions([
        {
          id: 'd1',
          question: 'Nur eine Option?',
          options: [{ id: 'a', label: 'A', consequence: '' }],
          chosenOptionId: null,
          rationale: '',
          leverage: 3,
        },
      ]),
    )

    expect(project.decisions).toEqual([])
  })

  it('öffnet eine Entscheidung wieder, deren gewählte Option fehlt', () => {
    const project = migrateProject(
      withOldDecisions([
        {
          id: 'd1',
          question: 'Web oder App?',
          options: [
            { id: 'web', label: 'Web', consequence: '' },
            { id: 'app', label: 'App', consequence: '' },
          ],
          chosenOptionId: 'weg',
          rationale: 'alt',
          leverage: 4,
        },
      ]),
    )

    expect(project.decisions[0]).toMatchObject({
      status: 'open',
      chosenOptionId: null,
      decidedAt: null,
    })
  })
})
