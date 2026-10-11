import type { Maturity, Project, Question } from '@/core/blueprint/schema'
import { SECTION_IDS, type SectionId } from '@/core/blueprint/sections'

/**
 * Deterministische Priorisierung der Fragen (Phase 4).
 *
 * Score = Hebel × Unsicherheit × Abhängigkeitsfaktor
 * - Hebel: 1 (Detail) bis 5 (Grundsatz), von der KI geschätzt.
 * - Unsicherheit: aus dem Reifegrad des betroffenen Abschnitts (leer 3, vage 2, entschieden 1).
 * - Abhängigkeitsfaktor: 1 + 0,5 je offener oder zurückgestellter Frage, die auf diese Frage wartet.
 *
 * Zurückgestellt (nicht gestellt) werden Fragen, deren Voraussetzung fehlt:
 * - `dependency`: eine Frage aus `dependsOn` ist noch nicht beantwortet.
 * - `section`: ein vorausgesetzter Abschnitt (siehe `SECTION_PREREQUISITES`) ist noch leer.
 * - `foundation`: Detailfrage (Hebel ≤ 2), solange ein Grundsatzabschnitt leer ist.
 */

export const UNCERTAINTY_BY_MATURITY: Record<Maturity, number> = {
  empty: 3,
  vague: 2,
  decided: 1,
}

export const DEPENDENT_BONUS = 0.5

/** Grundsatzabschnitte: Solange einer davon leer ist, warten Detailfragen. */
export const FOUNDATION_SECTIONS: readonly SectionId[] = ['problem', 'audience', 'features']

/** Höchster Hebel, der noch als Detailfrage gilt. */
export const DETAIL_LEVERAGE_MAX = 2

/** Welche Abschnitte nicht leer sein dürfen, bevor Fragen zu einem Abschnitt sinnvoll sind. */
export const SECTION_PREREQUISITES: Record<SectionId, readonly SectionId[]> = {
  problem: [],
  audience: [],
  features: ['problem'],
  nonGoals: ['features'],
  flows: ['features'],
  dataModel: ['features'],
  techStack: [],
  integrations: ['features'],
  risks: [],
  roadmap: ['features'],
}

export const DEFAULT_ROUND_SIZE = 3
export const MAX_ROUND_SIZE = 3

export type BlockReason =
  | { kind: 'dependency'; questionIds: string[] }
  | { kind: 'section'; sectionIds: SectionId[] }
  | { kind: 'foundation'; sectionIds: SectionId[] }

export interface RankedQuestion {
  question: Question
  score: number
}

export interface BlockedQuestion extends RankedQuestion {
  reason: BlockReason
}

export interface Prioritization {
  /** Offene, stellbare Fragen, beste zuerst. */
  ready: RankedQuestion[]
  /** Offene Fragen, deren Voraussetzung fehlt. */
  blocked: BlockedQuestion[]
  /** Mit „Später“ zurückgestellte Fragen, beste zuerst. */
  deferred: RankedQuestion[]
}

const isPending = (q: Question) => q.status === 'open' || q.status === 'deferred'

function countDependents(questions: readonly Question[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const q of questions) {
    if (!isPending(q)) continue
    for (const id of new Set(q.dependsOn)) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

export function scoreQuestion(question: Question, maturity: Maturity, dependents: number): number {
  return question.leverage * UNCERTAINTY_BY_MATURITY[maturity] * (1 + DEPENDENT_BONUS * dependents)
}

/** Grund, warum eine offene Frage noch nicht gestellt werden soll, oder `null`. */
export function blockReason(question: Question, project: Project): BlockReason | null {
  const byId = new Map(project.interview.questions.map((q) => [q.id, q]))
  // Unbekannte oder überholte Abhängigkeiten blockieren nicht.
  const missingQuestions = question.dependsOn.filter((id) => {
    const dependency = byId.get(id)
    return dependency !== undefined && isPending(dependency)
  })
  if (missingQuestions.length > 0) return { kind: 'dependency', questionIds: missingQuestions }

  const sections = project.blueprint.sections
  const isEmpty = (id: SectionId) => sections[id].maturity === 'empty'

  const missingSections = SECTION_PREREQUISITES[question.sectionId].filter(isEmpty)
  if (missingSections.length > 0) return { kind: 'section', sectionIds: missingSections }

  if (
    question.leverage <= DETAIL_LEVERAGE_MAX &&
    !FOUNDATION_SECTIONS.includes(question.sectionId)
  ) {
    const missingFoundation = FOUNDATION_SECTIONS.filter(isEmpty)
    if (missingFoundation.length > 0) return { kind: 'foundation', sectionIds: missingFoundation }
  }
  return null
}

/** Sortierung: Score, dann Hebel, dann Abschnittsreihenfolge, dann Alter, dann ID. */
function compareRanked(a: RankedQuestion, b: RankedQuestion): number {
  return (
    b.score - a.score ||
    b.question.leverage - a.question.leverage ||
    SECTION_IDS.indexOf(a.question.sectionId) - SECTION_IDS.indexOf(b.question.sectionId) ||
    a.question.createdAt.localeCompare(b.question.createdAt) ||
    a.question.id.localeCompare(b.question.id)
  )
}

export function prioritizeQuestions(project: Project): Prioritization {
  const questions = project.interview.questions
  const dependents = countDependents(questions)
  const rank = (question: Question): RankedQuestion => ({
    question,
    score: scoreQuestion(
      question,
      project.blueprint.sections[question.sectionId].maturity,
      dependents.get(question.id) ?? 0,
    ),
  })

  const ready: RankedQuestion[] = []
  const blocked: BlockedQuestion[] = []
  const deferred: RankedQuestion[] = []

  for (const question of questions) {
    if (question.status === 'deferred') deferred.push(rank(question))
    if (question.status !== 'open') continue
    const reason = blockReason(question, project)
    if (reason) blocked.push({ ...rank(question), reason })
    else ready.push(rank(question))
  }

  ready.sort(compareRanked)
  blocked.sort(compareRanked)
  deferred.sort(compareRanked)
  return { ready, blocked, deferred }
}

/**
 * Wählt die Fragen der nächsten Runde (1–3).
 * Reihenfolge der Quellen: stellbare Fragen; sind keine da, zurückgestellte („Später“);
 * sind auch die erschöpft, Fragen, die nur an leeren Abschnitten hängen (sonst ginge es nie weiter).
 * Fragen mit offener Abhängigkeit kommen nie vor ihrer Voraussetzung.
 */
export function selectRound(project: Project, size = DEFAULT_ROUND_SIZE): Question[] {
  const requested = Number.isFinite(size) ? Math.floor(size) : DEFAULT_ROUND_SIZE
  const limit = Math.min(Math.max(1, requested), MAX_ROUND_SIZE)
  const { ready, blocked, deferred } = prioritizeQuestions(project)

  const waitsForQuestion = (r: RankedQuestion) =>
    blockReason(r.question, project)?.kind === 'dependency'
  const sources = [
    ready,
    deferred.filter((r) => !waitsForQuestion(r)),
    blocked.filter((r) => r.reason.kind !== 'dependency'),
  ]
  const pool = sources.find((source) => source.length > 0) ?? []
  return pool.slice(0, limit).map((r) => r.question)
}
