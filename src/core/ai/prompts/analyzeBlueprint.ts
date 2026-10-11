import { z } from 'zod'
import { sectionIdSchema } from '@/core/blueprint/schema'
import type { EntryPoint, InterviewLogEntry, Project } from '@/core/blueprint/schema'
import { SECTION_IDS } from '@/core/blueprint/sections'
import type { ChatMessage } from '../types'
import { SECTION_GUIDE } from './classifyIdea'

/**
 * Prompt „Blueprint analysieren“: findet Lücken und Widersprüche und schlägt Fragen vor.
 * Die Reihenfolge der Fragen bestimmt nicht die KI, sondern `core/engine/prioritization.ts`.
 * Bei inhaltlichen Änderungen am Prompt `version` erhöhen und die Golden Files neu erzeugen.
 */
export const ANALYZE_BLUEPRINT_PROMPT_ID = 'analyze-blueprint'
export const ANALYZE_BLUEPRINT_PROMPT_VERSION = 1

/** Höchstzahl an Fragen pro Analyse (mehr werden beim Übernehmen verworfen). */
export const MAX_ANALYSIS_QUESTIONS = 8
/** Höchstzahl an Antwortoptionen pro Frage. */
export const MAX_QUESTION_OPTIONS = 4
/** So viele zuletzt beantwortete Fragen bekommt die KI als Kontext. */
export const MAX_LOG_CONTEXT = 30

const findingSchema = z.object({
  sectionIds: z.array(sectionIdSchema),
  text: z.string(),
})

export const questionCandidateSchema = z.object({
  /** Kurzer Schlüssel innerhalb dieser Antwort, z. B. "q1"; nur für `dependsOn`. */
  key: z.string(),
  sectionId: sectionIdSchema,
  text: z.string(),
  why: z.string(),
  /** 1 = Detail, 5 = Grundsatz. Werte außerhalb werden beim Übernehmen begrenzt. */
  leverage: z.number(),
  options: z.array(z.string()),
  dependsOn: z.array(z.string()),
})
export type QuestionCandidate = z.infer<typeof questionCandidateSchema>

export const blueprintAnalysisResultSchema = z.object({
  summary: z.string(),
  gaps: z.array(findingSchema),
  contradictions: z.array(findingSchema),
  questions: z.array(questionCandidateSchema),
})
export type BlueprintAnalysisResult = z.infer<typeof blueprintAnalysisResultSchema>

export interface AnalyzeBlueprintInput {
  project: Pick<Project, 'name' | 'entryPoint' | 'blueprint' | 'interview'>
  language: 'de' | 'en'
}

const ENTRY_POINT_HINT: Record<EntryPoint, string> = {
  noIdea: 'Die Person ist ohne konkrete Idee gestartet.',
  partialIdea: 'Die Person ist mit einer Teil-Idee gestartet.',
  almostDone: 'Die Person ist mit einem fast fertigen Konzept gestartet.',
}

export const LANGUAGE_NAME = { de: 'Deutsch', en: 'Englisch' } as const

export function describeBlueprint(project: Pick<Project, 'blueprint'>): string {
  return SECTION_IDS.map((id) => {
    const section = project.blueprint.sections[id]
    const content = section.content.trim() || '(leer)'
    return `## ${id} [${section.maturity}]\n${content}`
  }).join('\n\n')
}

export function describeLog(log: readonly InterviewLogEntry[]): string {
  const answered = log.filter((entry) => entry.action === 'answered').slice(-MAX_LOG_CONTEXT)
  if (answered.length === 0) return '(noch keine)'
  return answered.map((e) => `- [${e.sectionId}] ${e.questionText} → ${e.answerText}`).join('\n')
}

function describeDeferred(project: AnalyzeBlueprintInput['project']): string {
  const deferred = project.interview.questions.filter((q) => q.status === 'deferred')
  if (deferred.length === 0) return '(keine)'
  return deferred.map((q) => `- [${q.sectionId}] ${q.text}`).join('\n')
}

export function buildAnalyzeBlueprintMessages({
  project,
  language,
}: AnalyzeBlueprintInput): ChatMessage[] {
  const guide = Object.entries(SECTION_GUIDE)
    .map(([id, description]) => `- ${id}: ${description}`)
    .join('\n')

  const system = `Du hilfst Menschen, aus einer Projektidee einen klaren Blueprint für die Softwareentwicklung zu machen. Du bist ein erfahrener Produkt- und Software-Berater.

Aufgabe: Analysiere den Blueprint und finde heraus, welche Fragen die Person als Nächstes beantworten sollte.

Abschnitte:
${guide}

Reifegrade: "empty" = leer, "vague" = angedeutet oder unklar, "decided" = klar festgelegt.

Liefere:
- summary: 1–2 Sätze zum Stand des Blueprints (was steht, was fehlt am meisten).
- gaps: wichtige Lücken (fehlend oder zu vage), je mit den betroffenen Abschnitten.
- contradictions: echte Widersprüche zwischen Aussagen (z. B. "offline-first" vs. "Echtzeit-Zusammenarbeit"); leer, wenn es keine gibt.
- questions: höchstens ${MAX_ANALYSIS_QUESTIONS} Fragen, die die größten Unsicherheiten klären.

Regeln für Fragen:
- Eine Frage klärt genau eine Sache, ist kurz und ohne Fachjargon formuliert.
- sectionId: der Abschnitt, den die Antwort vor allem füllt.
- why: ein kurzer Satz, warum die Antwort wichtig ist.
- leverage (Hebel) von 1 bis 5: 5 = Grundsatzfrage, die viele andere Entscheidungen bestimmt (Kernproblem, Zielgruppe, Plattform, MVP-Umfang); 3 = wichtige Weichenstellung; 1 = Detail.
- Solange Grundsatzabschnitte (problem, audience, features) leer oder vage sind, stelle Grundsatzfragen, keine Detailfragen.
- options: 2–${MAX_QUESTION_OPTIONS} typische, sich gegenseitig ausschließende Antworten, wenn sich die Frage so beantworten lässt; sonst eine leere Liste. Keine Option "Sonstiges" (Freitext gibt es immer).
- key: "q1", "q2" usw.; dependsOn: Schlüssel von Fragen aus dieser Antwort, deren Antwort vorher feststehen muss, sonst leere Liste.
- Frage nichts, was im Blueprint oder in den bisherigen Antworten schon geklärt ist.
- Zurückgestellte Fragen nicht noch einmal stellen.

Schreibe alle Texte auf ${LANGUAGE_NAME[language]}. Antworte ausschließlich mit JSON nach dem vorgegebenen Schema.`

  const context = project.entryPoint ? `${ENTRY_POINT_HINT[project.entryPoint]}\n\n` : ''
  const user = `${context}Projekt: ${project.name}

# Blueprint
${describeBlueprint(project)}

# Bisherige Antworten
${describeLog(project.interview.log)}

# Zurückgestellte Fragen
${describeDeferred(project)}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
