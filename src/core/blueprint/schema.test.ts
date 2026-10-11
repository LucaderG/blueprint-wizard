import { createEmptyProject } from './factory'
import { decisionSchema, PROJECT_NAME_MAX_LENGTH, projectSchema } from './schema'
import { SECTION_IDS } from './sections'
import { makeProject } from './testing'

describe('projectSchema', () => {
  it('akzeptiert ein frisch angelegtes Projekt', () => {
    const project = createEmptyProject({
      id: 'a',
      name: '  Mein Projekt  ',
      now: new Date('2026-10-11T08:00:00Z'),
    })

    expect(projectSchema.parse(project)).toEqual(project)
    expect(project.name).toBe('Mein Projekt')
    expect(project.createdAt).toBe('2026-10-11T08:00:00.000Z')
    expect(Object.keys(project.blueprint.sections)).toEqual([...SECTION_IDS])
  })

  it.each([
    ['leerer Name', { name: '   ' }],
    ['zu langer Name', { name: 'x'.repeat(PROJECT_NAME_MAX_LENGTH + 1) }],
    ['falsche Schemaversion', { schemaVersion: 2 }],
    ['ungültiger Zeitstempel', { updatedAt: 'gestern' }],
    ['unbekannter Einstieg', { entryPoint: 'irgendwas' }],
  ])('lehnt ab: %s', (_label, overrides) => {
    expect(projectSchema.safeParse({ ...makeProject(), ...overrides }).success).toBe(false)
  })

  it('lehnt einen fehlenden Abschnitt ab', () => {
    const project = makeProject()
    const { problem: _removed, ...rest } = project.blueprint.sections

    expect(projectSchema.safeParse({ ...project, blueprint: { sections: rest } }).success).toBe(
      false,
    )
  })

  it('lehnt einen Abschnitt unter fremder ID ab', () => {
    const project = makeProject()
    const sections = {
      ...project.blueprint.sections,
      problem: { ...project.blueprint.sections.problem, id: 'risks' },
    }

    expect(projectSchema.safeParse({ ...project, blueprint: { sections } }).success).toBe(false)
  })
})

describe('decisionSchema', () => {
  const decision = {
    id: 'd1',
    question: 'Web oder Mobile?',
    options: [
      { id: 'web', label: 'Web', consequence: 'Läuft überall im Browser' },
      { id: 'mobile', label: 'Mobile', consequence: 'App-Store nötig' },
    ],
    chosenOptionId: null,
    rationale: '',
    leverage: 5,
  }

  it('akzeptiert offene und getroffene Entscheidungen', () => {
    expect(decisionSchema.safeParse(decision).success).toBe(true)
    expect(decisionSchema.safeParse({ ...decision, chosenOptionId: 'web' }).success).toBe(true)
  })

  it('lehnt eine gewählte Option ab, die es nicht gibt', () => {
    expect(decisionSchema.safeParse({ ...decision, chosenOptionId: 'desktop' }).success).toBe(false)
  })

  it.each([0, 6, 2.5])('lehnt Hebel %s ab', (leverage) => {
    expect(decisionSchema.safeParse({ ...decision, leverage }).success).toBe(false)
  })

  it('verlangt mindestens zwei Optionen', () => {
    expect(
      decisionSchema.safeParse({ ...decision, options: decision.options.slice(0, 1) }).success,
    ).toBe(false)
  })
})
