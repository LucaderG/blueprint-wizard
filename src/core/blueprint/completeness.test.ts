import { computeCompleteness } from './completeness'
import { SECTION_IDS, type SectionId } from './sections'
import { makeProject, withMaturity } from './testing'

const all = (maturity: 'empty' | 'vague' | 'decided') =>
  Object.fromEntries(SECTION_IDS.map((id) => [id, maturity])) as Record<SectionId, typeof maturity>

describe('computeCompleteness', () => {
  it.each([
    ['leer', 'empty', 0],
    ['vage', 'vague', 50],
    ['entschieden', 'decided', 100],
  ] as const)('ein komplett %er Blueprint ergibt %i %%', (_label, maturity, expected) => {
    const { blueprint } = withMaturity(makeProject(), all(maturity))

    expect(computeCompleteness(blueprint).total).toBe(expected)
  })

  it('gewichtet Grundsatzabschnitte stärker als Details', () => {
    const problem = withMaturity(makeProject(), { problem: 'decided' }).blueprint
    const risks = withMaturity(makeProject(), { risks: 'decided' }).blueprint

    // Gesamtgewicht 17: problem zählt 3, risks 1.
    expect(computeCompleteness(problem).total).toBe(18)
    expect(computeCompleteness(risks).total).toBe(6)
  })

  it('liefert Werte pro Abschnitt', () => {
    const { blueprint } = withMaturity(makeProject(), { audience: 'vague', features: 'decided' })

    const { sections } = computeCompleteness(blueprint)

    expect(sections.audience).toBe(50)
    expect(sections.features).toBe(100)
    expect(sections.problem).toBe(0)
  })
})
