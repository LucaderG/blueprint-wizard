import { acceptSuggestion, setEntryPoint, updateProfile, updateSection } from './editing'
import type { Project, ProjectProfile, Section } from './schema'
import { makeProject } from './testing'

/** Testhilfe: setzt Inhalt, Reife und Herkunft eines Abschnitts direkt. */
function withSection(
  project: Project,
  id: keyof Project['blueprint']['sections'],
  part: Partial<Section>,
) {
  return {
    ...project,
    blueprint: {
      sections: {
        ...project.blueprint.sections,
        [id]: { ...project.blueprint.sections[id], ...part },
      },
    },
  }
}

describe('updateSection', () => {
  it('setzt die Herkunft auf „user“, wenn sich der Inhalt ändert', () => {
    const project = withSection(makeProject(), 'problem', {
      content: 'Vom Modell',
      maturity: 'vague',
      source: 'aiSuggestion',
    })

    const next = updateSection(project, 'problem', { content: 'Von Hand' })

    expect(next.blueprint.sections.problem.source).toBe('user')
    expect(next.blueprint.sections.problem.content).toBe('Von Hand')
  })

  it('respektiert eine ausdrücklich angegebene Herkunft', () => {
    const project = makeProject()

    const next = updateSection(project, 'problem', { content: 'Text', source: 'aiAccepted' })

    expect(next.blueprint.sections.problem.source).toBe('aiAccepted')
  })

  it('behält die Herkunft, wenn der Inhalt unverändert bleibt', () => {
    const project = withSection(makeProject(), 'problem', {
      content: 'Gleich',
      maturity: 'vague',
      source: 'aiSuggestion',
    })

    const sameContent = updateSection(project, 'problem', { content: 'Gleich' })
    const maturityOnly = updateSection(project, 'problem', { maturity: 'decided' })

    expect(sameContent.blueprint.sections.problem.source).toBe('aiSuggestion')
    expect(maturityOnly.blueprint.sections.problem.source).toBe('aiSuggestion')
  })

  it('setzt die Reife auf „empty“, wenn der Inhalt geleert wird', () => {
    const project = withSection(makeProject(), 'problem', { content: 'Text', maturity: 'decided' })

    expect(
      updateSection(project, 'problem', { content: '' }).blueprint.sections.problem.maturity,
    ).toBe('empty')
  })

  it('behandelt Inhalt aus reinen Leerzeichen als leer', () => {
    const project = withSection(makeProject(), 'problem', { content: 'Text', maturity: 'vague' })

    const next = updateSection(project, 'problem', { content: '   \n ' })

    expect(next.blueprint.sections.problem.maturity).toBe('empty')
  })

  it('macht einen leeren Abschnitt mit Inhalt ohne Reifeangabe „vage“', () => {
    const next = updateSection(makeProject(), 'features', { content: 'Login' })

    expect(next.blueprint.sections.features.maturity).toBe('vague')
  })

  it('übernimmt eine ausdrücklich angegebene Reife', () => {
    const next = updateSection(makeProject(), 'features', {
      content: 'Login',
      maturity: 'decided',
    })

    expect(next.blueprint.sections.features.maturity).toBe('decided')
  })

  it('ändert das ursprüngliche Projekt nicht', () => {
    const project = makeProject()
    const snapshot = structuredClone(project)

    updateSection(project, 'problem', { content: 'Neu', maturity: 'decided' })

    expect(project).toEqual(snapshot)
  })

  it('lässt andere Abschnitte unangetastet (gleiche Objekte)', () => {
    const project = makeProject()

    const next = updateSection(project, 'problem', { content: 'Neu' })

    for (const id of Object.keys(project.blueprint.sections)) {
      if (id === 'problem') continue
      expect(next.blueprint.sections[id as keyof typeof project.blueprint.sections]).toBe(
        project.blueprint.sections[id as keyof typeof project.blueprint.sections],
      )
    }
  })
})

describe('acceptSuggestion', () => {
  it('macht einen KI-Vorschlag zu einem bestätigten Inhalt', () => {
    const project = withSection(makeProject(), 'risks', {
      content: 'Datenschutz',
      maturity: 'vague',
      source: 'aiSuggestion',
    })

    const next = acceptSuggestion(project, 'risks')

    expect(next.blueprint.sections.risks).toEqual({
      ...project.blueprint.sections.risks,
      source: 'aiAccepted',
    })
  })

  it.each(['user', 'aiAccepted'] as const)(
    'lässt Abschnitte mit Herkunft „%s“ unverändert (gleiches Objekt)',
    (source) => {
      const project = withSection(makeProject(), 'risks', { content: 'Text', source })

      expect(acceptSuggestion(project, 'risks')).toBe(project)
    },
  )
})

describe('setEntryPoint', () => {
  it('setzt den Einstiegspunkt und lässt den Rest gleich', () => {
    const project = makeProject()

    const next = setEntryPoint(project, 'almostDone')

    expect(next.entryPoint).toBe('almostDone')
    expect(next.blueprint).toBe(project.blueprint)
    expect(project.entryPoint).toBeNull()
  })
})

describe('updateProfile', () => {
  const profile: ProjectProfile = {
    pitch: '  Eine App für Fans  ',
    problem: ' Tourdaten sind verstreut ',
    audience: 'Fans',
    features: [' Tourkalender ', '', '   ', 'Erinnerungen'],
    platform: ' Web ',
    monetization: { model: ' Abo ', priceRange: ' 2–4 € ', reason: ' Wiederkehrender Nutzen ' },
    effort: 'medium',
    risks: ['Datenquellen', ' '],
  }

  it('trimmt Texte und entfernt leere Listeneinträge', () => {
    const project = updateProfile(makeProject(), profile)

    expect(project.profile).toEqual({
      pitch: 'Eine App für Fans',
      problem: 'Tourdaten sind verstreut',
      audience: 'Fans',
      features: ['Tourkalender', 'Erinnerungen'],
      platform: 'Web',
      monetization: { model: 'Abo', priceRange: '2–4 €', reason: 'Wiederkehrender Nutzen' },
      effort: 'medium',
      risks: ['Datenquellen'],
    })
  })

  it('lässt das Original unverändert', () => {
    const original = makeProject()
    updateProfile(original, profile)
    expect(original.profile).toBeNull()
  })

  it('verlangt einen Pitch', () => {
    expect(() => updateProfile(makeProject(), { ...profile, pitch: '  ' })).toThrow(RangeError)
  })
})
