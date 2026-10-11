import {
  additionsResultSchema,
  buildSuggestAdditionsMessages,
  MAX_ADDITIONS_PER_SECTION,
  SUGGEST_ADDITIONS_PROMPT_ID,
  SUGGEST_ADDITIONS_PROMPT_VERSION,
  type AdditionsResult,
} from '@/core/ai/prompts'
import { generateStructured } from '@/core/ai/structured'
import type { AiProvider, CompletionResult } from '@/core/ai/types'
import { updateSection } from '@/core/blueprint/editing'
import type { Addition, AdditionSectionId, Project } from '@/core/blueprint/schema'
import { normalizeText } from './cleaning'

/** Fehler bei einer ungültigen Aktion an einem Vorschlag. */
export class AdditionError extends Error {
  override name = 'AdditionError'
}

type Language = 'de' | 'en'

export interface SuggestAdditionsOptions {
  provider: AiProvider
  project: Project
  language: Language
  temperature?: number
  signal?: AbortSignal
}

export interface SuggestAdditionsResult {
  result: AdditionsResult
  calls: CompletionResult[]
  promptId: string
  promptVersion: number
}

/** Lässt die KI Ergänzungen für Kernfunktionen, Nicht-Ziele und Risiken vorschlagen. */
export async function suggestAdditions({
  provider,
  project,
  language,
  temperature = 0.5,
  signal,
}: SuggestAdditionsOptions): Promise<SuggestAdditionsResult> {
  const { data, calls } = await generateStructured({
    provider,
    schema: additionsResultSchema,
    name: 'blueprint_additions',
    messages: buildSuggestAdditionsMessages({ project, language }),
    temperature,
    signal,
  })
  return {
    result: data,
    calls,
    promptId: SUGGEST_ADDITIONS_PROMPT_ID,
    promptVersion: SUGGEST_ADDITIONS_PROMPT_VERSION,
  }
}

const stripBullet = (line: string) =>
  line
    .trim()
    .replace(/^(?:[-*+]|\d+[.)])\s+/, '')
    .trim()

/** Ein Punkt gilt als schon vorhanden, wenn er (normalisiert) als Zeile im Abschnitt steht. */
function sectionLines(project: Project, sectionId: AdditionSectionId): Set<string> {
  return new Set(
    project.blueprint.sections[sectionId].content
      .split('\n')
      .map((line) => normalizeText(stripBullet(line)))
      .filter(Boolean),
  )
}

export interface ApplyAdditionsOptions {
  now: Date
  createId?: () => string
}

/**
 * Übernimmt Vorschläge der KI.
 * - Bisher offene Vorschläge werden überholt (`dismissed`), angenommene/abgelehnte bleiben.
 * - Doppelte, schon angenommene, abgelehnte oder schon im Abschnitt stehende Punkte entfallen.
 * - Höchstens `MAX_ADDITIONS_PER_SECTION` pro Abschnitt.
 */
export function applyAdditionCandidates(
  project: Project,
  result: AdditionsResult,
  { now, createId = () => crypto.randomUUID() }: ApplyAdditionsOptions,
): Project {
  const timestamp = now.toISOString()
  const known = new Set(
    project.additions
      .filter((a) => a.status === 'accepted' || a.status === 'rejected')
      .map((a) => normalizeText(a.text)),
  )
  const kept = project.additions.map((a) =>
    a.status === 'open' ? { ...a, status: 'dismissed' as const } : a,
  )
  const lines = new Map<AdditionSectionId, Set<string>>()
  const perSection = new Map<AdditionSectionId, number>()

  const added: Addition[] = []
  for (const candidate of result.additions) {
    // Aufzählungszeichen der KI entfernen, sonst entstünde beim Anhängen „- - Text“.
    const text = stripBullet(candidate.text)
    const key = normalizeText(text)
    const count = perSection.get(candidate.sectionId) ?? 0
    if (!text || known.has(key) || count >= MAX_ADDITIONS_PER_SECTION) continue
    if (!lines.has(candidate.sectionId)) {
      lines.set(candidate.sectionId, sectionLines(project, candidate.sectionId))
    }
    if (lines.get(candidate.sectionId)?.has(key)) continue

    known.add(key)
    perSection.set(candidate.sectionId, count + 1)
    added.push({
      id: createId(),
      sectionId: candidate.sectionId,
      text,
      reason: candidate.reason.trim(),
      status: 'open',
      createdAt: timestamp,
      resolvedAt: null,
    })
  }

  return { ...project, additions: [...kept, ...added] }
}

function resolveAddition(
  project: Project,
  additionId: string,
  status: 'accepted' | 'rejected',
  now: Date,
): { project: Project; addition: Addition } {
  const addition = project.additions.find((a) => a.id === additionId)
  if (!addition) throw new AdditionError(`Unbekannter Vorschlag: ${additionId}`)
  if (addition.status !== 'open') {
    throw new AdditionError(`Vorschlag ${additionId} ist nicht offen (${addition.status})`)
  }
  const resolved: Addition = { ...addition, status, resolvedAt: now.toISOString() }
  return {
    addition: resolved,
    project: {
      ...project,
      additions: project.additions.map((a) => (a.id === additionId ? resolved : a)),
    },
  }
}

/**
 * Nimmt einen Vorschlag an: Er wird als Stichpunkt an den Abschnitt angehängt. Vorhandener Inhalt
 * bleibt unverändert; ein bisher leerer Abschnitt gilt danach als bestätigter KI-Inhalt.
 */
export function acceptAddition(project: Project, additionId: string, now: Date): Project {
  const { project: next, addition } = resolveAddition(project, additionId, 'accepted', now)
  const section = next.blueprint.sections[addition.sectionId]
  const existing = section.content.trimEnd()
  return updateSection(next, addition.sectionId, {
    content: existing ? `${existing}\n- ${addition.text}` : `- ${addition.text}`,
    source: existing ? section.source : 'aiAccepted',
  })
}

/** Lehnt einen Vorschlag ab; er wird nicht erneut vorgeschlagen. */
export function rejectAddition(project: Project, additionId: string, now: Date): Project {
  return resolveAddition(project, additionId, 'rejected', now).project
}
