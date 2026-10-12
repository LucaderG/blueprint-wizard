import { MockAiProvider, type Classification, type VariantCandidate } from '@/core/ai'
import { updateSection } from '@/core/blueprint/editing'
import {
  PROJECT_NAME_MAX_LENGTH,
  projectSchema,
  type ProjectProfile,
} from '@/core/blueprint/schema'
import { SECTION_IDS } from '@/core/blueprint/sections'
import { makeProject } from '@/core/blueprint/testing'
import { MAX_IDEA_TEXT_LENGTH } from './classification'
import {
  applyProfile,
  applyVariantCandidates,
  expandEntry,
  expandProfile,
  generateVariants,
  type VariantDraft,
} from './variants'

/** Eine Variante der KI mit gültigen Werten; `overrides` ändert einzelne Felder. */
function candidate(title: string, overrides: Partial<VariantCandidate> = {}): VariantCandidate {
  return {
    title,
    pitch: `Worum es bei ${title} geht.`,
    problem: 'Fans verpassen Konzerte.',
    audience: 'Fans einer Band',
    features: ['Tourdaten', 'Setlisten', 'Treffpunkte', 'Fotos teilen', 'Erinnerungen'],
    platform: 'Smartphone-App',
    monetization: { model: 'Freemium', priceRange: '2–4 € pro Monat', reason: 'Niedrige Hürde.' },
    effort: 'medium',
    risks: ['Rechte an Fotos', 'Wenig Nutzer außerhalb der Tour'],
    ...overrides,
  }
}

const variantsJson = (...candidates: VariantCandidate[]) => JSON.stringify({ variants: candidates })

const PROFILE: ProjectProfile = {
  pitch: 'Begleitet Fans auf Tour.',
  problem: 'Fans verpassen Konzerte.',
  audience: 'Fans',
  features: ['Tourdaten'],
  platform: 'App',
  monetization: { model: 'Freemium', priceRange: '2–4 €', reason: 'Hürde.' },
  effort: 'small',
  risks: ['Rechte'],
}

const fullClassification = (): Classification => ({
  projectName: 'Anderer Name',
  summary: 'Eine Tour-App.',
  sections: SECTION_IDS.map((id) => ({ id, content: `Inhalt ${id}`, maturity: 'vague' })),
})

describe('applyVariantCandidates', () => {
  it('übernimmt Titel und Steckbrief bereinigt', () => {
    const [draft] = applyVariantCandidates(
      [
        candidate('  Tour   Begleiter ', {
          pitch: '  Kurz. ',
          monetization: { model: ' Abo ', priceRange: ' 3 € ', reason: ' Weil. ' },
        }),
      ],
      { limit: 3 },
    )

    expect(draft).toEqual<VariantDraft>({
      name: 'Tour Begleiter',
      profile: {
        pitch: 'Kurz.',
        problem: 'Fans verpassen Konzerte.',
        audience: 'Fans einer Band',
        features: ['Tourdaten', 'Setlisten', 'Treffpunkte', 'Fotos teilen', 'Erinnerungen'],
        platform: 'Smartphone-App',
        monetization: { model: 'Abo', priceRange: '3 €', reason: 'Weil.' },
        effort: 'medium',
        risks: ['Rechte an Fotos', 'Wenig Nutzer außerhalb der Tour'],
      },
    })
  })

  it('begrenzt Funktionen auf 8 und Risiken auf 3 und entfernt Aufzählungszeichen und Doppelte', () => {
    const features = ['- Eins', '* Zwei', '3. Drei', 'Eins', '', ...'45678910'.split('')]
    const risks = ['A', 'B', 'b', 'C', 'D']

    const [draft] = applyVariantCandidates([candidate('X', { features, risks })], { limit: 1 })

    expect(draft?.profile.features).toEqual(['Eins', 'Zwei', 'Drei', '4', '5', '6', '7', '8'])
    expect(draft?.profile.risks).toEqual(['A', 'B', 'C'])
  })

  it('verwirft Varianten ohne Titel oder Pitch und doppelte Titel', () => {
    const drafts = applyVariantCandidates(
      [
        candidate('  '),
        candidate('Ohne Pitch', { pitch: ' ' }),
        candidate('Gleich'),
        candidate('gleich'),
        candidate('Anders'),
      ],
      { limit: 3 },
    )

    expect(drafts.map((d) => d.name)).toEqual(['Gleich', 'Anders'])
  })

  it('liefert höchstens so viele Varianten wie gewünscht', () => {
    const drafts = applyVariantCandidates([candidate('A'), candidate('B'), candidate('C')], {
      limit: 2,
    })

    expect(drafts.map((d) => d.name)).toEqual(['A', 'B'])
  })

  it('kürzt zu lange Titel auf die Länge eines Projektnamens', () => {
    const [draft] = applyVariantCandidates([candidate('x'.repeat(200))], { limit: 1 })

    expect(draft?.name).toHaveLength(PROJECT_NAME_MAX_LENGTH)
  })
})

describe('applyProfile', () => {
  it('setzt Name, Steckbrief und Einstieg und ergibt ein gültiges Projekt', () => {
    const project = applyProfile(makeProject(), { name: 'Tour-Begleiter', profile: PROFILE })

    expect(project).toMatchObject({
      name: 'Tour-Begleiter',
      profile: PROFILE,
      entryPoint: 'partialIdea',
    })
    expect(projectSchema.safeParse(project).success).toBe(true)
  })

  it('lässt die Abschnitte leer, weil ein Steckbrief noch kein Blueprint ist', () => {
    const project = applyProfile(makeProject(), { name: 'Tour', profile: PROFILE })

    expect(project.blueprint).toEqual(makeProject().blueprint)
  })
})

describe('generateVariants', () => {
  it('liefert die Varianten der KI mit Prompt-ID und Version', async () => {
    const provider = new MockAiProvider([variantsJson(candidate('Eins'), candidate('Zwei'))])

    const result = await generateVariants({ provider, idea: 'Fan-App', count: 2, language: 'de' })

    expect(result.candidates.map((c) => c.title)).toEqual(['Eins', 'Zwei'])
    expect(result.promptId).toBe('generate-variants')
    expect(result.promptVersion).toBe(1)
    expect(result.calls).toHaveLength(1)
    expect(provider.requests[0]?.jsonSchema?.name).toBe('project_variants')
    expect(provider.requests[0]?.messages.at(-1)?.content).toContain('genau 2 Steckbriefe')
  })

  it('begrenzt die Anzahl auf 1 bis 3', async () => {
    const provider = new MockAiProvider([variantsJson(), variantsJson()])

    await generateVariants({ provider, idea: 'Idee', count: 9, language: 'de' })
    await generateVariants({ provider, idea: 'Idee', count: 0, language: 'de' })

    expect(provider.requests[0]?.messages.at(-1)?.content).toContain('genau 3 Steckbriefe')
    expect(provider.requests[1]?.messages.at(-1)?.content).toContain('genau einen Steckbrief')
  })

  it.each([
    ['leer', '   '],
    ['zu lang', 'x'.repeat(MAX_IDEA_TEXT_LENGTH + 1)],
  ])('lehnt eine Idee ab, die %s ist, ohne die KI zu fragen', async (_label, idea) => {
    const provider = new MockAiProvider([])

    await expect(generateVariants({ provider, idea, count: 1, language: 'de' })).rejects.toThrow(
      RangeError,
    )
    expect(provider.requests).toHaveLength(0)
  })
})

describe('expandProfile', () => {
  it('schickt den Steckbrief und liefert die Einordnung', async () => {
    const provider = new MockAiProvider([JSON.stringify(fullClassification())])
    const project = applyProfile(makeProject(), { name: 'Tour-Begleiter', profile: PROFILE })

    const result = await expandProfile({ provider, project, language: 'de' })

    expect(result.classification.sections).toHaveLength(SECTION_IDS.length)
    expect(result.promptId).toBe('expand-profile')
    expect(result.promptVersion).toBe(1)
    expect(provider.requests[0]?.jsonSchema?.name).toBe('profile_expansion')
    expect(provider.requests[0]?.messages.at(-1)?.content).toContain('Titel: Tour-Begleiter')
  })

  it('lehnt Projekte ohne Steckbrief ab', async () => {
    const provider = new MockAiProvider([])

    await expect(
      expandProfile({ provider, project: makeProject(), language: 'de' }),
    ).rejects.toThrow(RangeError)
    expect(provider.requests).toHaveLength(0)
  })
})

describe('expandEntry', () => {
  it('füllt alle Abschnitte als KI-Vorschlag und behält Name und Steckbrief', () => {
    const project = applyProfile(makeProject(), { name: 'Tour-Begleiter', profile: PROFILE })

    const { project: expanded, updated } = expandEntry(project, fullClassification())

    expect(updated).toEqual([...SECTION_IDS])
    expect(expanded.name).toBe('Tour-Begleiter')
    expect(expanded.profile).toEqual(PROFILE)
    expect(expanded.entryPoint).toBe('partialIdea')
    for (const id of SECTION_IDS) {
      expect(expanded.blueprint.sections[id]).toMatchObject({
        content: `Inhalt ${id}`,
        source: 'aiSuggestion',
      })
    }
  })

  it('überschreibt nie eigenen Inhalt', () => {
    const project = updateSection(
      applyProfile(makeProject(), { name: 'Tour', profile: PROFILE }),
      'problem',
      { content: 'Mein Text' },
    )

    const { project: expanded, kept } = expandEntry(project, fullClassification())

    expect(kept).toEqual(['problem'])
    expect(expanded.blueprint.sections.problem).toMatchObject({
      content: 'Mein Text',
      source: 'user',
    })
  })
})
