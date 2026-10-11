import { createEmptyProject } from './factory'
import { additionSchema, decisionSchema, PROJECT_NAME_MAX_LENGTH, projectSchema } from './schema'
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
    ['falsche Schemaversion', { schemaVersion: 99 }],
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
  const option = (id: string, label: string) => ({
    id,
    label,
    pros: ['Läuft überall'],
    cons: ['Kein Store'],
    consequence: 'Browser-App',
  })
  const decision = {
    id: 'd1',
    sectionId: 'techStack',
    title: 'Web oder nativ?',
    context: 'Bestimmt den Aufwand.',
    leverage: 5,
    options: [option('web', 'Web'), option('native', 'Nativ')],
    recommendedOptionId: 'web',
    chosenOptionId: null,
    rationale: '',
    status: 'open',
    createdAt: '2026-01-10T09:00:00.000Z',
    decidedAt: null,
  }
  const decided = {
    ...decision,
    status: 'decided',
    chosenOptionId: 'web',
    rationale: 'Ein Browser reicht für den Anfang.',
    decidedAt: '2026-01-11T09:00:00.000Z',
  }

  it('akzeptiert offene und getroffene Entscheidungen', () => {
    expect(decisionSchema.safeParse(decision).success).toBe(true)
    expect(decisionSchema.safeParse(decided).success).toBe(true)
  })

  it('lehnt eine getroffene Entscheidung ohne gewählte Option ab', () => {
    expect(decisionSchema.safeParse({ ...decided, chosenOptionId: null }).success).toBe(false)
  })

  it('lehnt eine gewählte Option bei einer offenen Entscheidung ab', () => {
    expect(decisionSchema.safeParse({ ...decision, chosenOptionId: 'web' }).success).toBe(false)
  })

  it('lehnt einen Zeitpunkt bei einer offenen Entscheidung ab', () => {
    expect(
      decisionSchema.safeParse({ ...decision, decidedAt: '2026-01-11T09:00:00.000Z' }).success,
    ).toBe(false)
  })

  it('lehnt eine getroffene Entscheidung ohne Zeitpunkt ab', () => {
    expect(decisionSchema.safeParse({ ...decided, decidedAt: null }).success).toBe(false)
  })

  it('lehnt eine unbekannte gewählte Option ab', () => {
    expect(decisionSchema.safeParse({ ...decided, chosenOptionId: 'desktop' }).success).toBe(false)
  })

  it('lehnt eine unbekannte empfohlene Option ab', () => {
    expect(decisionSchema.safeParse({ ...decision, recommendedOptionId: 'desktop' }).success).toBe(
      false,
    )
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

describe('additionSchema', () => {
  const addition = {
    id: 'a1',
    sectionId: 'risks',
    text: 'Datenverlust bei Gerätewechsel',
    reason: 'Wird in den Planungen oft übersehen.',
    status: 'open',
    createdAt: '2026-01-10T09:00:00.000Z',
    resolvedAt: null,
  }

  it('akzeptiert offene, angenommene und abgelehnte Vorschläge', () => {
    expect(additionSchema.safeParse(addition).success).toBe(true)
    expect(
      additionSchema.safeParse({
        ...addition,
        status: 'accepted',
        resolvedAt: '2026-01-11T09:00:00.000Z',
      }).success,
    ).toBe(true)
    expect(
      additionSchema.safeParse({
        ...addition,
        status: 'rejected',
        resolvedAt: '2026-01-11T09:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it.each([
    ['Abschnitt, der keine Ergänzungen zulässt', { sectionId: 'problem' }],
    ['unbekannter Status', { status: 'pending' }],
    ['leerer Text', { text: '' }],
    ['ungültiger Zeitstempel', { createdAt: 'gestern' }],
  ])('lehnt ab: %s', (_label, overrides) => {
    expect(additionSchema.safeParse({ ...addition, ...overrides }).success).toBe(false)
  })
})

describe('Eindeutige IDs', () => {
  const decision = {
    id: 'd1',
    sectionId: 'techStack',
    title: 'Web oder nativ?',
    context: '',
    leverage: 3,
    options: [
      { id: 'web', label: 'Web', pros: [], cons: [], consequence: '' },
      { id: 'native', label: 'Nativ', pros: [], cons: [], consequence: '' },
    ],
    recommendedOptionId: null,
    chosenOptionId: null,
    rationale: '',
    status: 'open',
    createdAt: '2026-01-10T09:00:00.000Z',
    decidedAt: null,
  }
  const addition = {
    id: 'a1',
    sectionId: 'features',
    text: 'Offline-Modus',
    reason: '',
    status: 'open',
    createdAt: '2026-01-10T09:00:00.000Z',
    resolvedAt: null,
  }

  it('lehnt doppelte Entscheidungs-IDs im Projekt ab', () => {
    const project = { ...makeProject(), decisions: [decision, { ...decision, title: 'Anders?' }] }

    expect(projectSchema.safeParse(project).success).toBe(false)
  })

  it('lehnt doppelte Vorschlags-IDs im Projekt ab', () => {
    const project = { ...makeProject(), additions: [addition, { ...addition, text: 'Anders' }] }

    expect(projectSchema.safeParse(project).success).toBe(false)
  })

  it('akzeptiert verschiedene IDs', () => {
    const project = {
      ...makeProject(),
      decisions: [decision, { ...decision, id: 'd2' }],
      additions: [addition, { ...addition, id: 'a2' }],
    }

    expect(projectSchema.safeParse(project).success).toBe(true)
  })
})
