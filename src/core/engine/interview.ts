import {
  ANALYZE_BLUEPRINT_PROMPT_ID,
  ANALYZE_BLUEPRINT_PROMPT_VERSION,
  blueprintAnalysisResultSchema,
  buildAnalyzeBlueprintMessages,
  buildIntegrateAnswersMessages,
  INTEGRATE_ANSWERS_PROMPT_ID,
  INTEGRATE_ANSWERS_PROMPT_VERSION,
  integrationResultSchema,
  MAX_ANALYSIS_QUESTIONS,
  MAX_QUESTION_OPTIONS,
  type AnsweredQuestion,
  type BlueprintAnalysisResult,
} from '@/core/ai/prompts'
import { generateStructured } from '@/core/ai/structured'
import type { AiProvider, CompletionResult } from '@/core/ai/types'
import { updateSection } from '@/core/blueprint/editing'
import type {
  AnalysisFinding,
  InterviewLogEntry,
  Maturity,
  Project,
  Question,
  QuestionAnswer,
} from '@/core/blueprint/schema'
import { SECTION_IDS, type SectionId } from '@/core/blueprint/sections'
import { clampLeverage, cleanTextList, keepHighestLeverage, normalizeText } from './cleaning'

type Language = 'de' | 'en'

/** Fehler bei einer ungültigen Aktion im Fragenmotor (z. B. unbekannte Frage). */
export class InterviewError extends Error {
  override name = 'InterviewError'
}

const normalize = normalizeText

function cleanOptions(options: readonly string[]): string[] {
  const result = cleanTextList(options, MAX_QUESTION_OPTIONS)
  // Eine einzelne Option ist keine Auswahl.
  return result.length >= 2 ? result : []
}

function cleanFindings(findings: readonly AnalysisFinding[]): AnalysisFinding[] {
  return findings
    .map((f) => ({ sectionIds: [...new Set(f.sectionIds)], text: f.text.trim() }))
    .filter((f) => f.text !== '')
}

/** Prüft, ob `to` von `from` aus über die Abhängigkeiten erreichbar ist. */
function reaches(edges: ReadonlyMap<string, readonly string[]>, from: string, to: string): boolean {
  const stack = [from]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const current = stack.pop() as string
    if (current === to) return true
    if (seen.has(current)) continue
    seen.add(current)
    stack.push(...(edges.get(current) ?? []))
  }
  return false
}

export interface ApplyAnalysisOptions {
  now: Date
  createId?: () => string
  promptVersion?: number
}

/**
 * Übernimmt das Ergebnis einer Lückenanalyse in den Fragenmotor.
 * - Bisher offene Fragen werden durch die neue Analyse überholt (`dismissed`).
 * - Beantwortete und zurückgestellte Fragen bleiben; inhaltsgleiche Kandidaten werden verworfen.
 * - Hebel wird auf 1–5 begrenzt, Optionen bereinigt, Abhängigkeiten auf IDs abgebildet;
 *   unbekannte Schlüssel, Selbstbezüge und Kreise werden entfernt.
 */
export function applyAnalysis(
  project: Project,
  result: BlueprintAnalysisResult,
  {
    now,
    createId = () => crypto.randomUUID(),
    promptVersion = ANALYZE_BLUEPRINT_PROMPT_VERSION,
  }: ApplyAnalysisOptions,
): Project {
  const timestamp = now.toISOString()
  const kept = project.interview.questions.map((q) =>
    q.status === 'open' ? { ...q, status: 'dismissed' as const } : q,
  )
  const knownTexts = new Set(
    kept
      .filter((q) => q.status === 'answered' || q.status === 'deferred')
      .map((q) => normalize(q.text)),
  )

  const idByKey = new Map<string, string>()
  const added: Question[] = []
  const pendingDependsOn = new Map<string, readonly string[]>()

  // Erst bereinigen, dann auf die Fragen mit dem höchsten Hebel kürzen (nicht nach Position).
  const candidates = keepHighestLeverage(
    result.questions.filter((candidate) => {
      const key = normalize(candidate.text)
      if (!key || knownTexts.has(key)) return false
      knownTexts.add(key)
      return true
    }),
    MAX_ANALYSIS_QUESTIONS,
    (candidate) => clampLeverage(candidate.leverage),
  )

  for (const candidate of candidates) {
    const text = candidate.text.trim()
    const id = createId()
    const key = candidate.key.trim()
    if (key && !idByKey.has(key)) idByKey.set(key, id)
    pendingDependsOn.set(id, candidate.dependsOn)
    added.push({
      id,
      sectionId: candidate.sectionId,
      text,
      why: candidate.why.trim(),
      leverage: clampLeverage(candidate.leverage),
      options: cleanOptions(candidate.options).map((label, index) => ({
        id: `${id}-o${index + 1}`,
        label,
      })),
      dependsOn: [],
      status: 'open',
      answer: null,
      createdAt: timestamp,
      answeredAt: null,
    })
  }

  // Abhängigkeiten in Reihenfolge der Kandidaten eintragen; Kanten, die einen Kreis schließen, entfallen.
  const edges = new Map<string, string[]>()
  for (const question of added) {
    const dependsOn: string[] = []
    for (const key of pendingDependsOn.get(question.id) ?? []) {
      const target = idByKey.get(key.trim())
      if (!target || target === question.id || dependsOn.includes(target)) continue
      if (reaches(edges, target, question.id)) continue
      dependsOn.push(target)
      edges.set(question.id, dependsOn)
    }
    question.dependsOn = dependsOn
  }

  return {
    ...project,
    interview: {
      ...project.interview,
      questions: [...kept, ...added],
      analysis: {
        summary: result.summary.trim(),
        gaps: cleanFindings(result.gaps),
        contradictions: cleanFindings(result.contradictions),
        analyzedAt: timestamp,
        promptVersion,
      },
    },
  }
}

function findActiveQuestion(project: Project, questionId: string): Question {
  const question = project.interview.questions.find((q) => q.id === questionId)
  if (!question) throw new InterviewError(`Unbekannte Frage: ${questionId}`)
  if (question.status !== 'open' && question.status !== 'deferred') {
    throw new InterviewError(`Frage ${questionId} ist nicht mehr offen (${question.status})`)
  }
  return question
}

function replaceQuestion(
  project: Project,
  question: Question,
  logText: string,
  now: Date,
): Project {
  const action: InterviewLogEntry['action'] =
    question.status === 'answered' ? 'answered' : 'deferred'
  return {
    ...project,
    interview: {
      ...project.interview,
      questions: project.interview.questions.map((q) => (q.id === question.id ? question : q)),
      log: [
        ...project.interview.log,
        {
          questionId: question.id,
          questionText: question.text,
          sectionId: question.sectionId,
          action,
          answerText: logText,
          at: now.toISOString(),
        },
      ],
    },
  }
}

/** Lesbarer Text einer Antwort (für Verlauf und Prompts). */
export function formatAnswer(question: Pick<Question, 'options'>, answer: QuestionAnswer): string {
  if (answer.kind === 'text') return answer.text.trim()
  const label = question.options.find((o) => o.id === answer.optionId)?.label ?? answer.optionId
  const note = answer.note.trim()
  return note ? `${label} – ${note}` : label
}

/** Beantwortet eine offene oder zurückgestellte Frage und schreibt den Verlauf fort. */
export function answerQuestion(
  project: Project,
  questionId: string,
  answer: QuestionAnswer,
  now: Date,
): Project {
  const question = findActiveQuestion(project, questionId)
  const cleaned: QuestionAnswer =
    answer.kind === 'text'
      ? { kind: 'text', text: answer.text.trim() }
      : { kind: 'option', optionId: answer.optionId, note: answer.note.trim() }
  if (cleaned.kind === 'text' && cleaned.text === '') {
    throw new InterviewError('Die Antwort ist leer')
  }
  if (cleaned.kind === 'option' && !question.options.some((o) => o.id === cleaned.optionId)) {
    throw new InterviewError(`Unbekannte Option: ${cleaned.optionId}`)
  }
  const answered: Question = {
    ...question,
    status: 'answered',
    answer: cleaned,
    answeredAt: now.toISOString(),
  }
  return replaceQuestion(project, answered, formatAnswer(question, cleaned), now)
}

/** Stellt eine Frage zurück („Später“). Sie kommt wieder, wenn nichts Wichtigeres offen ist. */
export function deferQuestion(project: Project, questionId: string, now: Date): Project {
  const question = findActiveQuestion(project, questionId)
  return replaceQuestion(project, { ...question, status: 'deferred' }, '', now)
}

function answeredQuestions(project: Project, questionIds: readonly string[]): AnsweredQuestion[] {
  const wanted = new Set(questionIds)
  return project.interview.questions
    .filter((q) => wanted.has(q.id) && q.status === 'answered' && q.answer)
    .map((q) => ({
      sectionId: q.sectionId,
      question: q.text,
      answer: formatAnswer(q, q.answer as QuestionAnswer),
    }))
}

export interface AnalyzeBlueprintOptions {
  provider: AiProvider
  project: Project
  language: Language
  temperature?: number
  signal?: AbortSignal
}

export interface AnalyzeBlueprintResult {
  result: BlueprintAnalysisResult
  calls: CompletionResult[]
  promptId: string
  promptVersion: number
}

/** Lässt die KI den Blueprint analysieren (Lücken, Widersprüche, Fragen-Kandidaten). */
export async function analyzeBlueprint({
  provider,
  project,
  language,
  temperature = 0.3,
  signal,
}: AnalyzeBlueprintOptions): Promise<AnalyzeBlueprintResult> {
  const { data, calls } = await generateStructured({
    provider,
    schema: blueprintAnalysisResultSchema,
    name: 'blueprint_analysis',
    messages: buildAnalyzeBlueprintMessages({ project, language }),
    temperature,
    signal,
  })
  return {
    result: data,
    calls,
    promptId: ANALYZE_BLUEPRINT_PROMPT_ID,
    promptVersion: ANALYZE_BLUEPRINT_PROMPT_VERSION,
  }
}

/** Vorschlag für einen Abschnitt nach dem Einarbeiten der Antworten. */
export interface IntegrationProposal {
  sectionId: SectionId
  before: string
  after: string
  maturity: Maturity
  /** Der neue Text ist deutlich kürzer als der alte – möglicher Datenverlust. */
  shrinkWarning: boolean
}

/** Mindestlänge, ab der ein starkes Schrumpfen als Warnung gilt. */
export const SHRINK_MIN_LENGTH = 40
/** Unter diesem Anteil der alten Länge gilt der neue Text als verdächtig kurz. */
export const SHRINK_RATIO = 0.6

export function isSuspiciousShrink(before: string, after: string): boolean {
  const oldLength = before.trim().length
  return oldLength >= SHRINK_MIN_LENGTH && after.trim().length < oldLength * SHRINK_RATIO
}

export interface IntegrateAnswersOptions {
  provider: AiProvider
  project: Project
  questionIds: readonly string[]
  language: Language
  temperature?: number
  signal?: AbortSignal
}

export interface IntegrateAnswersResult {
  proposals: IntegrationProposal[]
  calls: CompletionResult[]
  promptId: string
  promptVersion: number
}

/**
 * Lässt die KI die Antworten einer Runde in die betroffenen Abschnitte einarbeiten.
 * Liefert nur Vorschläge; übernommen wird erst mit `applyIntegration`.
 */
export async function integrateAnswers({
  provider,
  project,
  questionIds,
  language,
  temperature = 0.2,
  signal,
}: IntegrateAnswersOptions): Promise<IntegrateAnswersResult> {
  const answers = answeredQuestions(project, questionIds)
  const result = {
    promptId: INTEGRATE_ANSWERS_PROMPT_ID,
    promptVersion: INTEGRATE_ANSWERS_PROMPT_VERSION,
  }
  if (answers.length === 0) return { ...result, proposals: [], calls: [] }

  const affected = SECTION_IDS.filter((id) => answers.some((a) => a.sectionId === id))
  const sections = affected.map((id) => project.blueprint.sections[id])
  const { data, calls } = await generateStructured({
    provider,
    schema: integrationResultSchema,
    name: 'answer_integration',
    messages: buildIntegrateAnswersMessages({ sections, answers, language }),
    temperature,
    signal,
  })

  const proposals: IntegrationProposal[] = []
  for (const suggestion of data.sections) {
    const after = suggestion.content.trim()
    if (!affected.includes(suggestion.id) || after === '') continue
    if (proposals.some((p) => p.sectionId === suggestion.id)) continue
    const before = project.blueprint.sections[suggestion.id].content
    if (after === before.trim()) continue
    proposals.push({
      sectionId: suggestion.id,
      before,
      after,
      maturity: suggestion.maturity === 'empty' ? 'vague' : suggestion.maturity,
      shrinkWarning: isSuspiciousShrink(before, after),
    })
  }
  return { ...result, proposals, calls }
}

/** Übernimmt bestätigte Vorschläge. Die Person hat sie geprüft, daher `source: 'aiAccepted'`. */
export function applyIntegration(
  project: Project,
  proposals: readonly Pick<IntegrationProposal, 'sectionId' | 'after' | 'maturity'>[],
): Project {
  return proposals.reduce(
    (current, p) =>
      updateSection(current, p.sectionId, {
        content: p.after,
        maturity: p.maturity,
        source: 'aiAccepted',
      }),
    project,
  )
}

/**
 * Hängt Antworten wörtlich als Stichpunkte an die Abschnitte an (ohne KI).
 * Fallback, wenn die KI nicht erreichbar ist oder die Person die Vorschläge verwirft.
 */
export function appendAnswersToSections(project: Project, questionIds: readonly string[]): Project {
  return answeredQuestions(project, questionIds).reduce((current, a) => {
    const section = current.blueprint.sections[a.sectionId]
    const existing = section.content.trimEnd()
    const separator = /[?:]$/.test(a.question) ? ' ' : ': '
    const line = `- ${a.question}${separator}${a.answer}`
    return updateSection(current, a.sectionId, {
      content: existing ? `${existing}\n${line}` : line,
      source: existing ? section.source : 'user',
    })
  }, project)
}
