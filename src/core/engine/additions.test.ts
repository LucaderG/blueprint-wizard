import { AiError } from '@/core/ai/errors'
import { MockAiProvider } from '@/core/ai/mockProvider'
import {
  MAX_ADDITIONS_PER_SECTION,
  SUGGEST_ADDITIONS_PROMPT_ID,
  SUGGEST_ADDITIONS_PROMPT_VERSION,
  type AdditionCandidate,
  type AdditionsResult,
} from '@/core/ai/prompts'
import { projectSchema } from '@/core/blueprint/schema'
import type { Addition, AdditionSectionId, Project, Section } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import { makeProject } from '@/core/blueprint/testing'
import {
  AdditionError,
  acceptAddition,
  applyAdditionCandidates,
  rejectAddition,
  suggestAdditions,
} from './additions'

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-01T10:00:00.000Z')
const NOW_ISO = NOW.toISOString()
const CREATED = '2026-01-01T00:00:00.000Z'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Deterministische IDs: a1, a2, … */
const sequentialIds = () => {
  let n = 0
  return () => `a${++n}`
}

const parsed = (project: Project): Project => projectSchema.parse(project)

/** Fehlertext einer Funktion, die einen `AdditionError` werfen muss. */
function additionErrorOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    if (error instanceof AdditionError) return error.message
    throw error
  }
  throw new Error('Kein Fehler geworfen')
}

function makeAddition(id: string, overrides: Partial<Addition> = {}): Addition {
  return {
    id,
    sectionId: 'features',
    text: `Punkt ${id}`,
    reason: 'Grund',
    status: 'open',
    createdAt: CREATED,
    resolvedAt: null,
    ...overrides,
  }
}

/** Projekt mit den angegebenen Inhalten; Reife „angedeutet“, sobald Inhalt steht. */
function withContent(
  contents: Partial<Record<SectionId, string>>,
  additions: Addition[] = [],
  base: Project = makeProject(),
): Project {
  const sections = { ...base.blueprint.sections }
  for (const [id, content] of Object.entries(contents) as [SectionId, string][]) {
    sections[id] = {
      ...sections[id],
      content,
      maturity: content.trim() ? 'vague' : 'empty',
    }
  }
  return { ...base, blueprint: { sections }, additions }
}

const candidate = (
  sectionId: AdditionSectionId,
  text: string,
  reason = 'Passt zum Ziel.',
): AdditionCandidate => ({ sectionId, text, reason })

const resultOf = (...additions: AdditionCandidate[]): AdditionsResult => ({ additions })

/** Übernimmt Vorschläge und prüft das Ergebnis gegen das Schema. */
const apply = (
  project: Project,
  candidates: AdditionCandidate[],
  createId: () => string = sequentialIds(),
) => parsed(applyAdditionCandidates(project, resultOf(...candidates), { now: NOW, createId }))

// ---------------------------------------------------------------------------
// applyAdditionCandidates
// ---------------------------------------------------------------------------

describe('applyAdditionCandidates', () => {
  it('überholt offene Vorschläge (dismissed) und hängt die neuen offenen an', () => {
    const before = withContent({}, [makeAddition('old')])

    const next = apply(before, [candidate('features', '  Offline-Modus  ', ' Für Reisen. ')])

    expect(next.additions).toEqual([
      makeAddition('old', { status: 'dismissed' }),
      {
        id: 'a1',
        sectionId: 'features',
        text: 'Offline-Modus',
        reason: 'Für Reisen.',
        status: 'open',
        createdAt: NOW_ISO,
        resolvedAt: null,
      },
    ])
  })

  it('lässt angenommene und abgelehnte Vorschläge unverändert', () => {
    const accepted = makeAddition('acc', { status: 'accepted', resolvedAt: CREATED })
    const rejected = makeAddition('rej', { status: 'rejected', resolvedAt: CREATED })

    const next = apply(withContent({}, [accepted, rejected]), [])

    expect(next.additions).toEqual([accepted, rejected])
  })

  it.each([
    ['angenommen', 'accepted'],
    ['abgelehnt', 'rejected'],
  ] as const)('schlägt keinen Text erneut vor, der schon %s ist', (_label, status) => {
    const known = makeAddition('known', { status, text: 'Offline-Modus' })

    const next = apply(withContent({}, [known]), [
      candidate('features', 'offline-modus'),
      candidate('features', '  OFFLINE-MODUS '),
    ])

    expect(next.additions.filter((a) => a.status === 'open')).toEqual([])
  })

  it('schlägt einen bisher offenen, nun überholten Text wieder vor', () => {
    const before = withContent({}, [makeAddition('old', { text: 'Offline-Modus' })])

    const next = apply(before, [candidate('features', 'Offline-Modus')])

    expect(next.additions.map((a) => [a.text, a.status])).toEqual([
      ['Offline-Modus', 'dismissed'],
      ['Offline-Modus', 'open'],
    ])
  })

  it('schlägt einen nach Ablehnung abgelehnten Text in einem anderen Abschnitt nicht vor', () => {
    const rejected = makeAddition('rej', {
      sectionId: 'risks',
      text: 'Datenschutz',
      status: 'rejected',
      resolvedAt: CREATED,
    })

    const next = apply(withContent({}, [rejected]), [candidate('features', 'datenschutz')])

    expect(next.additions.filter((a) => a.status === 'open')).toEqual([])
  })

  it.each([
    ['ohne Aufzählungszeichen', 'Rezepte planen'],
    ['mit "- "', '- Rezepte planen'],
    ['mit "* "', '* Rezepte planen'],
    ['mit "+ "', '+ Rezepte planen'],
    ['mit "1. "', '1. Rezepte planen'],
    ['mit "2) "', '2) Rezepte planen'],
    ['eingerückt', '   - Rezepte planen'],
  ])('schlägt einen Punkt nicht vor, der schon im Abschnitt steht (%s)', (_label, line) => {
    const project = withContent({ features: `Einleitung\n${line}` })

    const next = apply(project, [
      candidate('features', '  REZEPTE   planen '),
      candidate('features', 'Einkaufsliste'),
    ])

    expect(next.additions.map((a) => a.text)).toEqual(['Einkaufsliste'])
  })

  it('zählt einen Punkt in einem anderen Abschnitt nicht als vorhanden', () => {
    const project = withContent({ risks: 'Datenschutz' })

    const next = apply(project, [candidate('features', 'Datenschutz')])

    expect(next.additions.map((a) => a.text)).toEqual(['Datenschutz'])
  })

  it(`begrenzt je Abschnitt auf ${MAX_ADDITIONS_PER_SECTION} Vorschläge, getrennt nach Abschnitten`, () => {
    const features = Array.from({ length: MAX_ADDITIONS_PER_SECTION + 2 }, (_, i) =>
      candidate('features', `Funktion ${i + 1}`),
    )

    const next = apply(withContent({}), [...features, candidate('risks', 'Ein Risiko')])

    const open = next.additions.filter((a) => a.status === 'open')
    expect(open.filter((a) => a.sectionId === 'features')).toHaveLength(MAX_ADDITIONS_PER_SECTION)
    expect(open.filter((a) => a.sectionId === 'risks').map((a) => a.text)).toEqual(['Ein Risiko'])
  })

  it('zählen übersprungene Punkte nicht zur Obergrenze', () => {
    const project = withContent({ features: 'A' })

    const next = apply(project, [
      candidate('features', 'A'),
      candidate('features', 'B'),
      candidate('features', 'C'),
      candidate('features', 'D'),
      candidate('features', 'E'),
      candidate('features', 'F'),
    ])

    expect(next.additions.map((a) => a.text)).toEqual(['B', 'C', 'D', 'E'])
  })

  it('übernimmt doppelte Vorschläge innerhalb der Antwort nur einmal', () => {
    const next = apply(withContent({}), [
      candidate('features', 'Offline-Modus'),
      candidate('features', 'offline-modus'),
      candidate('features', ' Offline-Modus '),
    ])

    expect(next.additions.map((a) => a.text)).toEqual(['Offline-Modus'])
  })

  it('verwirft leere Texte', () => {
    const next = apply(withContent({}), [candidate('features', ''), candidate('risks', '   ')])

    expect(next.additions).toEqual([])
  })

  it('verändert das übergebene Projekt nicht', () => {
    const project = withContent({}, [makeAddition('old')])
    const snapshot = structuredClone(project)

    apply(project, [candidate('features', 'Neu')])

    expect(project).toEqual(snapshot)
  })

  it('vergibt ohne createId eine UUID', () => {
    const next = applyAdditionCandidates(withContent({}), resultOf(candidate('risks', 'Risiko')), {
      now: NOW,
    })

    expect(next.additions[0]?.id).toMatch(UUID)
  })
})

// ---------------------------------------------------------------------------
// Annehmen und Ablehnen
// ---------------------------------------------------------------------------

describe('acceptAddition', () => {
  it('hängt den Punkt als Stichpunkt an und lässt vorhandenen Inhalt unverändert', () => {
    const original = '- Rezepte planen\nNur im Web'
    const project = withContent({ features: original }, [
      makeAddition('a1', { text: 'Einkaufsliste' }),
    ])

    const next = parsed(acceptAddition(project, 'a1', NOW))

    expect(next.blueprint.sections.features).toEqual({
      id: 'features',
      content: `${original}\n- Einkaufsliste`,
      maturity: 'vague',
      source: 'user',
    })
    expect(next.additions[0]).toMatchObject({ status: 'accepted', resolvedAt: NOW_ISO })
  })

  it('lässt andere Vorschläge unverändert', () => {
    const other = makeAddition('a2', { text: 'Teilen' })
    const project = withContent({}, [makeAddition('a1', { text: 'B' }), other])

    expect(acceptAddition(project, 'a1', NOW).additions[1]).toEqual(other)
  })

  it('verändert keine anderen Abschnitte', () => {
    const project = withContent({ features: 'A', risks: 'Risiko' }, [
      makeAddition('a1', { text: 'B' }),
    ])

    const next = acceptAddition(project, 'a1', NOW)

    expect(next.blueprint.sections.risks).toEqual(project.blueprint.sections.risks)
    expect(next.blueprint.sections.problem).toEqual(project.blueprint.sections.problem)
  })

  it('entfernt beim Anhängen nur den Leerraum am Ende des Abschnitts', () => {
    const project = withContent({ features: '- A\n\n' }, [makeAddition('a1', { text: 'B' })])

    const next = parsed(acceptAddition(project, 'a1', NOW))

    expect(next.blueprint.sections.features.content).toBe('- A\n- B')
  })

  it.each([
    ['leerer Abschnitt', ''],
    ['nur Leerraum', '   \n  '],
  ])('macht einen Punkt in einem Abschnitt (%s) zum bestätigten KI-Inhalt', (_label, content) => {
    const project = withContent({ features: content }, [
      makeAddition('a1', { text: 'Einkaufsliste' }),
    ])

    const next = parsed(acceptAddition(project, 'a1', NOW))

    expect(next.blueprint.sections.features).toEqual({
      id: 'features',
      content: '- Einkaufsliste',
      maturity: 'vague',
      source: 'aiAccepted',
    })
  })

  it('behält die Quelle eines bereits gefüllten Abschnitts', () => {
    const base = withContent({ features: '- A' }, [makeAddition('a1', { text: 'B' })])
    const project = {
      ...base,
      blueprint: {
        sections: {
          ...base.blueprint.sections,
          features: { ...base.blueprint.sections.features, source: 'aiSuggestion' } as Section,
        },
      },
    }

    const next = acceptAddition(project, 'a1', NOW)

    expect(next.blueprint.sections.features.source).toBe('aiSuggestion')
  })

  it('lehnt unbekannte Vorschläge ab', () => {
    expect(additionErrorOf(() => acceptAddition(withContent({}), 'x', NOW))).toBe(
      'Unbekannter Vorschlag: x',
    )
  })

  it.each([
    ['abgelehnt', 'rejected'],
    ['angenommen', 'accepted'],
    ['überholt', 'dismissed'],
  ] as const)('lehnt einen %s Vorschlag ab', (_label, status) => {
    const project = withContent({}, [makeAddition('a1', { status })])

    expect(additionErrorOf(() => acceptAddition(project, 'a1', NOW))).toBe(
      `Vorschlag a1 ist nicht offen (${status})`,
    )
  })
})

describe('rejectAddition', () => {
  it('lässt andere Vorschläge unverändert', () => {
    const other = makeAddition('a2', { text: 'Teilen' })
    const project = withContent({}, [makeAddition('a1'), other])

    expect(rejectAddition(project, 'a1', NOW).additions[1]).toEqual(other)
  })

  it('lehnt einen offenen Vorschlag ab, ohne den Blueprint zu ändern', () => {
    const project = withContent({ features: '- A' }, [makeAddition('a1')])

    const next = parsed(rejectAddition(project, 'a1', NOW))

    expect(next.additions[0]).toMatchObject({ status: 'rejected', resolvedAt: NOW_ISO })
    expect(next.blueprint).toEqual(project.blueprint)
  })

  it('wird danach nicht erneut vorgeschlagen', () => {
    const rejected = rejectAddition(
      withContent({}, [makeAddition('a1', { text: 'Offline' })]),
      'a1',
      NOW,
    )

    const next = apply(rejected, [candidate('features', 'offline')])

    expect(next.additions.filter((a) => a.status === 'open')).toEqual([])
  })

  it('lehnt unbekannte Vorschläge ab', () => {
    expect(additionErrorOf(() => rejectAddition(withContent({}), 'x', NOW))).toBe(
      'Unbekannter Vorschlag: x',
    )
  })

  it('lehnt einen schon entschiedenen Vorschlag ab', () => {
    const project = withContent({}, [
      makeAddition('a1', { status: 'accepted', resolvedAt: CREATED }),
    ])

    expect(additionErrorOf(() => rejectAddition(project, 'a1', NOW))).toBe(
      'Vorschlag a1 ist nicht offen (accepted)',
    )
  })

  it('kann einen Vorschlag nicht zweimal annehmen', () => {
    const once = acceptAddition(withContent({}, [makeAddition('a1')]), 'a1', NOW)

    expect(additionErrorOf(() => acceptAddition(once, 'a1', NOW))).toBe(
      'Vorschlag a1 ist nicht offen (accepted)',
    )
  })
})

// ---------------------------------------------------------------------------
// KI-Vorschlag mit MockAiProvider
// ---------------------------------------------------------------------------

describe('suggestAdditions', () => {
  const project = makeProject({ name: 'Rezeptplaner' })
  const validJson = JSON.stringify(resultOf(candidate('features', 'Offline-Modus', 'Für Reisen.')))

  it('fragt mit dem Schema blueprint_additions an', async () => {
    const provider = new MockAiProvider([validJson])

    const outcome = await suggestAdditions({ provider, project, language: 'de' })

    expect(provider.requests[0]?.jsonSchema?.name).toBe('blueprint_additions')
    expect(outcome.result.additions).toEqual([
      candidate('features', 'Offline-Modus', 'Für Reisen.'),
    ])
    expect(outcome.calls).toHaveLength(1)
    expect(outcome.promptId).toBe(SUGGEST_ADDITIONS_PROMPT_ID)
    expect(outcome.promptVersion).toBe(SUGGEST_ADDITIONS_PROMPT_VERSION)
  })

  it('verwendet standardmäßig Temperatur 0,5 und reicht eine eigene Temperatur durch', async () => {
    const provider = new MockAiProvider([validJson, validJson])

    await suggestAdditions({ provider, project, language: 'de' })
    await suggestAdditions({ provider, project, language: 'de', temperature: 0.1 })

    expect(provider.requests.map((r) => r.temperature)).toEqual([0.5, 0.1])
  })

  it('weist die Ausgabesprache im Prompt aus', async () => {
    const provider = new MockAiProvider([validJson, validJson])

    await suggestAdditions({ provider, project, language: 'de' })
    await suggestAdditions({ provider, project, language: 'en' })

    expect(provider.requests[0]?.messages[0]?.content).toContain('auf Deutsch')
    expect(provider.requests[1]?.messages[0]?.content).toContain('Englisch')
  })

  it('repariert einen Vorschlag mit unzulässigem Abschnitt (problem) mit einem zweiten Aufruf', async () => {
    const invalid = JSON.stringify({
      additions: [{ sectionId: 'problem', text: 'Zu allgemein', reason: 'x' }],
    })
    const provider = new MockAiProvider([invalid, validJson])

    const outcome = await suggestAdditions({ provider, project, language: 'de' })

    expect(outcome.calls).toHaveLength(2)
    expect(outcome.result.additions[0]?.sectionId).toBe('features')
  })

  it('wirft invalidResponse, wenn auch der zweite Versuch ungültig ist', async () => {
    const provider = new MockAiProvider(['kein JSON', '{"additions": 3}'])

    const error = await suggestAdditions({ provider, project, language: 'de' }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(AiError)
    expect(error).toMatchObject({ code: 'invalidResponse' })
  })
})
