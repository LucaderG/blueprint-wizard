import {
  buildIdentifyDecisionsMessages,
  decisionsResultSchema,
  IDENTIFY_DECISIONS_PROMPT_ID,
  IDENTIFY_DECISIONS_PROMPT_VERSION,
  MAX_DECISION_OPTIONS,
  type DecisionsResult,
} from '@/core/ai/prompts'
import { generateStructured } from '@/core/ai/structured'
import type { AiProvider, CompletionResult } from '@/core/ai/types'
import type { Decision, DecisionOption, Project } from '@/core/blueprint/schema'
import { SECTION_IDS } from '@/core/blueprint/sections'
import { clampLeverage, cleanTextList, keepHighestLeverage, normalizeText } from './cleaning'
import { UNCERTAINTY_BY_MATURITY } from './prioritization'

/**
 * So viele Entscheidungen übernimmt eine Ermittlung höchstens. Bewusst größer als die Bitte im Prompt
 * (`MAX_DECISION_CANDIDATES`), damit über die Rangfolge der Kern entsteht und nicht über die Position.
 */
export const MAX_DECISIONS_PER_RUN = 12
/** So viele offene Entscheidungen zeigt die Ansicht „Wichtigste Entscheidungen“ als Kern an. */
export const CORE_DECISION_LIMIT = 7
/** Höchstzahl an Vor- bzw. Nachteilen pro Option. */
export const MAX_PROS_CONS = 3

/** Fehler bei einer ungültigen Aktion an einer Entscheidung (z. B. unbekannte ID). */
export class DecisionError extends Error {
  override name = 'DecisionError'
}

type Language = 'de' | 'en'

export interface IdentifyDecisionsOptions {
  provider: AiProvider
  project: Project
  language: Language
  temperature?: number
  signal?: AbortSignal
}

export interface IdentifyDecisionsResult {
  result: DecisionsResult
  calls: CompletionResult[]
  promptId: string
  promptVersion: number
}

/** Lässt die KI die Kernentscheidungen des Projekts ermitteln. */
export async function identifyDecisions({
  provider,
  project,
  language,
  temperature = 0.3,
  signal,
}: IdentifyDecisionsOptions): Promise<IdentifyDecisionsResult> {
  const { data, calls } = await generateStructured({
    provider,
    schema: decisionsResultSchema,
    name: 'core_decisions',
    messages: buildIdentifyDecisionsMessages({ project, language }),
    temperature,
    signal,
  })
  return {
    result: data,
    calls,
    promptId: IDENTIFY_DECISIONS_PROMPT_ID,
    promptVersion: IDENTIFY_DECISIONS_PROMPT_VERSION,
  }
}

export interface ApplyDecisionsOptions {
  now: Date
  createId?: () => string
}

/**
 * Übernimmt ermittelte Entscheidungen.
 * - Bisher offene Entscheidungen werden überholt (`dismissed`); entschiedene bleiben.
 * - Höchstens `MAX_DECISIONS_PER_RUN`; gekürzt wird nach Hebel, nicht nach Position.
 * - Kandidaten mit dem Titel einer schon entschiedenen oder verworfenen Entscheidung entfallen.
 * - Optionen werden bereinigt (leer/doppelt raus, höchstens vier); unter zwei Optionen entfällt
 *   der Kandidat. Die Empfehlung zeigt danach auf dieselbe Option wie vorher oder ist `null`.
 */
export function applyDecisionCandidates(
  project: Project,
  result: DecisionsResult,
  { now, createId = () => crypto.randomUUID() }: ApplyDecisionsOptions,
): Project {
  const timestamp = now.toISOString()
  const knownTitles = new Set(
    project.decisions.filter((d) => d.status !== 'open').map((d) => normalizeText(d.title)),
  )
  const kept = project.decisions.map((d) =>
    d.status === 'open' ? { ...d, status: 'dismissed' as const } : d,
  )

  const added: Decision[] = []
  for (const candidate of result.decisions) {
    const title = candidate.title.trim()
    if (!title || knownTitles.has(normalizeText(title))) continue

    const id = createId()
    const seenLabels = new Set<string>()
    const options: DecisionOption[] = []
    let recommendedOptionId: string | null = null
    candidate.options.forEach((option, index) => {
      const label = option.label.trim()
      const key = normalizeText(label)
      if (!label || seenLabels.has(key) || options.length >= MAX_DECISION_OPTIONS) return
      seenLabels.add(key)
      const optionId = `${id}-o${options.length + 1}`
      if (candidate.recommendedOption === index) recommendedOptionId = optionId
      options.push({
        id: optionId,
        label,
        pros: cleanTextList(option.pros, MAX_PROS_CONS),
        cons: cleanTextList(option.cons, MAX_PROS_CONS),
        consequence: option.consequence.trim(),
      })
    })
    if (options.length < 2) continue

    knownTitles.add(normalizeText(title))
    added.push({
      id,
      sectionId: candidate.sectionId,
      title,
      context: candidate.context.trim(),
      leverage: clampLeverage(candidate.leverage),
      options,
      recommendedOptionId,
      chosenOptionId: null,
      rationale: '',
      status: 'open',
      createdAt: timestamp,
      decidedAt: null,
    })
  }

  const limited = keepHighestLeverage(added, MAX_DECISIONS_PER_RUN, (d) => d.leverage)
  return { ...project, decisions: [...kept, ...limited] }
}

/** Gewicht einer offenen Entscheidung: Hebel × Unsicherheit des betroffenen Abschnitts. */
export function decisionScore(decision: Decision, project: Project): number {
  const maturity = project.blueprint.sections[decision.sectionId].maturity
  return decision.leverage * UNCERTAINTY_BY_MATURITY[maturity]
}

export interface DecisionRanking {
  /** Die wichtigsten offenen Entscheidungen (höchstens `CORE_DECISION_LIMIT`). */
  core: Decision[]
  /** Weitere offene Entscheidungen. */
  more: Decision[]
  /** Entscheidungsprotokoll: getroffene Entscheidungen in zeitlicher Reihenfolge. */
  log: Decision[]
}

/**
 * Rangfolge der Entscheidungen (deterministisch): Score, dann Hebel, dann Abschnittsreihenfolge,
 * dann Alter, dann ID.
 */
export function rankDecisions(project: Project, limit = CORE_DECISION_LIMIT): DecisionRanking {
  const open = project.decisions
    .filter((d) => d.status === 'open')
    .map((decision) => ({ decision, score: decisionScore(decision, project) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.decision.leverage - a.decision.leverage ||
        SECTION_IDS.indexOf(a.decision.sectionId) - SECTION_IDS.indexOf(b.decision.sectionId) ||
        a.decision.createdAt.localeCompare(b.decision.createdAt) ||
        a.decision.id.localeCompare(b.decision.id),
    )
    .map((r) => r.decision)
  const log = project.decisions
    .filter((d) => d.status === 'decided')
    .sort(
      (a, b) => (a.decidedAt ?? '').localeCompare(b.decidedAt ?? '') || a.id.localeCompare(b.id),
    )
  const size = Math.max(0, Math.floor(limit))
  return { core: open.slice(0, size), more: open.slice(size), log }
}

function findDecision(project: Project, id: string): Decision {
  const decision = project.decisions.find((d) => d.id === id)
  if (!decision) throw new DecisionError(`Unbekannte Entscheidung: ${id}`)
  return decision
}

function replaceDecision(project: Project, decision: Decision): Project {
  return {
    ...project,
    decisions: project.decisions.map((d) => (d.id === decision.id ? decision : d)),
  }
}

/** Trifft eine Entscheidung (auch eine schon getroffene neu) und hält die Begründung fest. */
export function decide(
  project: Project,
  decisionId: string,
  optionId: string,
  rationale: string,
  now: Date,
): Project {
  const decision = findDecision(project, decisionId)
  if (decision.status === 'dismissed') {
    throw new DecisionError(`Entscheidung ${decisionId} ist verworfen`)
  }
  if (!decision.options.some((o) => o.id === optionId)) {
    throw new DecisionError(`Unbekannte Option: ${optionId}`)
  }
  return replaceDecision(project, {
    ...decision,
    status: 'decided',
    chosenOptionId: optionId,
    rationale: rationale.trim(),
    decidedAt: now.toISOString(),
  })
}

/** Öffnet eine getroffene oder verworfene Entscheidung wieder; die Begründung bleibt als Entwurf. */
export function reopenDecision(project: Project, decisionId: string): Project {
  const decision = findDecision(project, decisionId)
  if (decision.status === 'open') return project
  return replaceDecision(project, {
    ...decision,
    status: 'open',
    chosenOptionId: null,
    decidedAt: null,
  })
}

/** Verwirft eine offene Entscheidung (sie wird nicht erneut vorgeschlagen). */
export function dismissDecision(project: Project, decisionId: string): Project {
  const decision = findDecision(project, decisionId)
  if (decision.status !== 'open') {
    throw new DecisionError(`Entscheidung ${decisionId} ist nicht offen (${decision.status})`)
  }
  return replaceDecision(project, { ...decision, status: 'dismissed' })
}

/** Die gewählte Option einer getroffenen Entscheidung oder `null`. */
export function chosenOption(decision: Decision): DecisionOption | null {
  return decision.options.find((o) => o.id === decision.chosenOptionId) ?? null
}
