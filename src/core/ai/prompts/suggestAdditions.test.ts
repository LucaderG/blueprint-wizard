import type { Addition, Project } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import { makeProject } from '@/core/blueprint/testing'
import type { ChatMessage } from '../types'
import {
  additionsResultSchema,
  buildSuggestAdditionsMessages,
  MAX_ADDITIONS_PER_SECTION,
  SUGGEST_ADDITIONS_PROMPT_ID,
  SUGGEST_ADDITIONS_PROMPT_VERSION,
} from './suggestAdditions'

// ---------------------------------------------------------------------------
// Feste Beispiele
// ---------------------------------------------------------------------------

const CREATED = '2026-01-10T09:00:00.000Z'

/** Textform der Nachrichten, mit der die Golden Files verglichen werden. */
const asText = (messages: ChatMessage[]) =>
  messages.map((m) => `### ${m.role}\n${m.content}`).join('\n\n')

function addition(id: string, overrides: Partial<Addition> = {}): Addition {
  return {
    id,
    sectionId: 'features',
    text: `Punkt ${id}`,
    reason: 'Passt zum Ziel.',
    status: 'open',
    createdAt: CREATED,
    resolvedAt: null,
    ...overrides,
  }
}

/** Projekt mit gesetzten Abschnitten (Inhalt und Reife); übrige bleiben leer. */
function withSections(
  base: Project,
  sections: Partial<Record<SectionId, { content: string; maturity: 'vague' | 'decided' }>>,
): Project {
  const copy = { ...base.blueprint.sections }
  for (const [id, value] of Object.entries(sections) as [
    SectionId,
    { content: string; maturity: 'vague' | 'decided' },
  ][]) {
    copy[id] = { ...copy[id], ...value }
  }
  return { ...base, blueprint: { sections: copy } }
}

/** Vager Blueprint: nur das Problem ist angedeutet. */
const vagueProject: Project = withSections(makeProject({ name: 'Wochenplaner' }), {
  problem: {
    content: 'Wochenplanung mit Rezepten kostet Zeit und endet oft ohne Einkaufsliste.',
    maturity: 'vague',
  },
})

/** Fast fertiger Blueprint mit angenommenen und abgelehnten Vorschlägen. */
const almostDoneProject: Project = (() => {
  const base = withSections(makeProject({ name: 'Habit-Tracker' }), {
    problem: { content: 'Gewohnheiten werden nicht konsequent verfolgt.', maturity: 'decided' },
    audience: { content: 'Einzelpersonen, die Gewohnheiten aufbauen wollen.', maturity: 'decided' },
    features: {
      content: '- Gewohnheiten anlegen\n- Täglich abhaken',
      maturity: 'decided',
    },
    nonGoals: { content: 'Social-Features in Version 1.', maturity: 'decided' },
    risks: { content: 'Datenverlust bei Gerätewechsel.', maturity: 'vague' },
  })
  return {
    ...base,
    additions: [
      addition('acc', {
        sectionId: 'features',
        text: 'Erinnerungen per Benachrichtigung',
        status: 'accepted',
        resolvedAt: CREATED,
      }),
      addition('rej', {
        sectionId: 'risks',
        text: 'Zu viele Nutzerdaten',
        status: 'rejected',
        resolvedAt: CREATED,
      }),
      addition('open', {
        sectionId: 'nonGoals',
        text: 'Kein Export',
        status: 'open',
      }),
    ],
  }
})()

const build = (project: Project, language: 'de' | 'en' = 'de') =>
  buildSuggestAdditionsMessages({ project, language })

const userText = (project: Project, language: 'de' | 'en' = 'de') =>
  build(project, language).find((m) => m.role === 'user')?.content ?? ''

const systemText = (project: Project, language: 'de' | 'en' = 'de') =>
  build(project, language).find((m) => m.role === 'system')?.content ?? ''

// ---------------------------------------------------------------------------
// Golden Files: der vollständige Prompt bleibt stabil.
// Bei inhaltlichen Änderungen VERSION erhöhen und die Dateien neu erzeugen.
// ---------------------------------------------------------------------------

describe('buildSuggestAdditionsMessages – Golden Files', () => {
  it('vager Blueprint', async () => {
    await expect(asText(build(vagueProject))).toMatchFileSnapshot(
      './__golden__/suggest-additions-vague.txt',
    )
  })

  it('fast fertiger Blueprint mit angenommenen und abgelehnten Vorschlägen', async () => {
    await expect(asText(build(almostDoneProject))).toMatchFileSnapshot(
      './__golden__/suggest-additions-almost-done.txt',
    )
  })
})

// ---------------------------------------------------------------------------
// Aufbau der Nachrichten
// ---------------------------------------------------------------------------

describe('buildSuggestAdditionsMessages', () => {
  it('liefert eine System- und eine Nutzernachricht in dieser Reihenfolge', () => {
    expect(build(vagueProject).map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('hat eine ID und eine Version', () => {
    expect(SUGGEST_ADDITIONS_PROMPT_ID).toMatch(/^[a-z-]+$/)
    expect(Number.isInteger(SUGGEST_ADDITIONS_PROMPT_VERSION)).toBe(true)
    expect(SUGGEST_ADDITIONS_PROMPT_VERSION).toBeGreaterThanOrEqual(1)
  })

  it('nennt die Obergrenze je Abschnitt und die drei Abschnitte', () => {
    const system = systemText(vagueProject)

    expect(system).toContain(`Höchstens ${MAX_ADDITIONS_PER_SECTION} Vorschläge pro Abschnitt`)
    expect(system).toContain('- features:')
    expect(system).toContain('- nonGoals:')
    expect(system).toContain('- risks:')
  })

  it('weist die Ausgabesprache aus', () => {
    expect(systemText(vagueProject, 'de')).toContain('auf Deutsch')
    expect(systemText(vagueProject, 'en')).toContain('Englisch')
  })

  it('listet angenommene und abgelehnte Vorschläge getrennt, offene nicht', () => {
    const user = userText(almostDoneProject)
    const accepted = user.slice(
      user.indexOf('# Schon angenommene Vorschläge'),
      user.indexOf('# Abgelehnte Vorschläge'),
    )
    const rejected = user.slice(user.indexOf('# Abgelehnte Vorschläge'))

    expect(accepted).toContain('- [features] Erinnerungen per Benachrichtigung')
    expect(accepted).not.toContain('Kein Export')
    expect(rejected).toContain('- [risks] Zu viele Nutzerdaten')
    expect(rejected).not.toContain('Kein Export')
  })

  it('schreibt „(keine)“, wenn es keine angenommenen oder abgelehnten Vorschläge gibt', () => {
    const user = userText(vagueProject)

    expect(user).toContain('# Schon angenommene Vorschläge\n(keine)')
    expect(user).toContain('# Abgelehnte Vorschläge (nicht erneut vorschlagen)\n(keine)')
  })

  it('nennt den Projektnamen und den Blueprint', () => {
    const user = userText(vagueProject)

    expect(user.startsWith('Projekt: Wochenplaner')).toBe(true)
    expect(user).toContain('## problem [vague]')
  })
})

// ---------------------------------------------------------------------------
// Antwortschema
// ---------------------------------------------------------------------------

describe('additionsResultSchema', () => {
  const candidate = {
    sectionId: 'nonGoals',
    text: 'Keine Social-Funktionen',
    reason: 'Hält den Umfang klein.',
  }

  it('akzeptiert ein gültiges Ergebnis und eine leere Liste', () => {
    expect(additionsResultSchema.safeParse({ additions: [candidate] }).success).toBe(true)
    expect(additionsResultSchema.safeParse({ additions: [] }).success).toBe(true)
  })

  it.each(['features', 'nonGoals', 'risks'])('akzeptiert den Abschnitt %s', (sectionId) => {
    expect(
      additionsResultSchema.safeParse({ additions: [{ ...candidate, sectionId }] }).success,
    ).toBe(true)
  })

  const invalid: { name: string; data: unknown }[] = [
    {
      name: 'Abschnitt außerhalb der Ergänzungen (problem)',
      data: { additions: [{ ...candidate, sectionId: 'problem' }] },
    },
    {
      name: 'unbekannter Abschnitt',
      data: { additions: [{ ...candidate, sectionId: 'backend' }] },
    },
    {
      name: 'fehlender Text',
      data: { additions: [{ sectionId: 'features', reason: 'x' }] },
    },
    {
      name: 'fehlende Begründung',
      data: { additions: [{ sectionId: 'features', text: 'x' }] },
    },
    {
      name: 'Vorschläge als Text',
      data: { additions: 'Keine Social-Funktionen' },
    },
  ]

  it.each(invalid)('lehnt ab: $name', ({ data }) => {
    expect(additionsResultSchema.safeParse(data).success).toBe(false)
  })
})
