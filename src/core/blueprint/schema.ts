import { z } from 'zod'
import { SECTION_IDS, type SectionId } from './sections'

/** Aktuelle Version des gespeicherten Projektformats. Bei jeder Schemaänderung erhöhen und eine Migration ergänzen. */
export const CURRENT_SCHEMA_VERSION = 2

export const sectionIdSchema = z.enum(SECTION_IDS)

/** Reifegrad eines Abschnitts: leer → vage → entschieden. */
export const maturitySchema = z.enum(['empty', 'vague', 'decided'])
export type Maturity = z.infer<typeof maturitySchema>

/** Woher der aktuelle Inhalt eines Abschnitts stammt. */
export const sectionSourceSchema = z.enum(['user', 'aiSuggestion', 'aiAccepted'])
export type SectionSource = z.infer<typeof sectionSourceSchema>

/** Wie stark eine Frage oder Entscheidung das Projekt verändert (1 = Detail, 5 = Grundsatz). */
export const leverageSchema = z.number().int().min(1).max(5)

export const decisionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  consequence: z.string(),
})
export type DecisionOption = z.infer<typeof decisionOptionSchema>

export const decisionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    options: z.array(decisionOptionSchema).min(2),
    chosenOptionId: z.string().nullable(),
    rationale: z.string(),
    leverage: leverageSchema,
  })
  .refine((d) => d.chosenOptionId === null || d.options.some((o) => o.id === d.chosenOptionId), {
    message: 'chosenOptionId muss auf eine vorhandene Option zeigen',
    path: ['chosenOptionId'],
  })
export type Decision = z.infer<typeof decisionSchema>

export const sectionSchema = z.object({
  id: sectionIdSchema,
  content: z.string(),
  maturity: maturitySchema,
  source: sectionSourceSchema,
  decisions: z.array(decisionSchema),
})
export type Section = z.infer<typeof sectionSchema>

const sectionsShape = Object.fromEntries(SECTION_IDS.map((id) => [id, sectionSchema])) as Record<
  SectionId,
  typeof sectionSchema
>

export const blueprintSchema = z
  .object({ sections: z.object(sectionsShape) })
  .refine((b) => SECTION_IDS.every((id) => b.sections[id].id === id), {
    message: 'Jeder Abschnitt muss unter seiner eigenen ID liegen',
    path: ['sections'],
  })
export type Blueprint = z.infer<typeof blueprintSchema>

export const entryPointSchema = z.enum(['noIdea', 'partialIdea', 'almostDone'])
export type EntryPoint = z.infer<typeof entryPointSchema>

export const PROJECT_NAME_MAX_LENGTH = 120

export const projectNameSchema = z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH)

/** Status einer Frage im Fragenmotor. `dismissed` = durch eine neue Analyse überholt. */
export const questionStatusSchema = z.enum(['open', 'answered', 'deferred', 'dismissed'])
export type QuestionStatus = z.infer<typeof questionStatusSchema>

export const questionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
})
export type QuestionOption = z.infer<typeof questionOptionSchema>

/** Antwort auf eine Frage: gewählte Option (optional mit Ergänzung) oder Freitext. */
export const questionAnswerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('option'), optionId: z.string().min(1), note: z.string() }),
  z.object({ kind: z.literal('text'), text: z.string().trim().min(1) }),
])
export type QuestionAnswer = z.infer<typeof questionAnswerSchema>

export const questionSchema = z
  .object({
    id: z.string().min(1),
    /** Abschnitt, den die Antwort vor allem betrifft. */
    sectionId: sectionIdSchema,
    text: z.string().min(1),
    /** Warum die Frage wichtig ist (kurz, für die Anzeige). */
    why: z.string(),
    leverage: leverageSchema,
    options: z.array(questionOptionSchema),
    /** IDs von Fragen, die vorher beantwortet sein müssen. */
    dependsOn: z.array(z.string().min(1)),
    status: questionStatusSchema,
    answer: questionAnswerSchema.nullable(),
    createdAt: z.iso.datetime(),
    answeredAt: z.iso.datetime().nullable(),
  })
  .refine((q) => (q.status === 'answered') === (q.answer !== null), {
    message: 'Nur beantwortete Fragen haben eine Antwort',
    path: ['answer'],
  })
  .refine(
    (q) => {
      const answer = q.answer
      return answer?.kind !== 'option' || q.options.some((o) => o.id === answer.optionId)
    },
    { message: 'optionId muss auf eine vorhandene Option zeigen', path: ['answer'] },
  )
export type Question = z.infer<typeof questionSchema>

/** Ein Eintrag im Verlauf: welche Frage wann wie behandelt wurde. */
export const interviewLogEntrySchema = z.object({
  questionId: z.string().min(1),
  questionText: z.string().min(1),
  sectionId: sectionIdSchema,
  action: z.enum(['answered', 'deferred']),
  /** Lesbare Antwort (Optionstext und/oder Freitext); leer bei „Später“. */
  answerText: z.string(),
  at: z.iso.datetime(),
})
export type InterviewLogEntry = z.infer<typeof interviewLogEntrySchema>

export const analysisFindingSchema = z.object({
  sectionIds: z.array(sectionIdSchema),
  text: z.string().min(1),
})
export type AnalysisFinding = z.infer<typeof analysisFindingSchema>

/** Ergebnis der letzten Lückenanalyse. */
export const blueprintAnalysisSchema = z.object({
  summary: z.string(),
  gaps: z.array(analysisFindingSchema),
  contradictions: z.array(analysisFindingSchema),
  analyzedAt: z.iso.datetime(),
  promptVersion: z.number().int().min(1),
})
export type BlueprintAnalysis = z.infer<typeof blueprintAnalysisSchema>

/** Zustand des Fragenmotors eines Projekts. */
export const interviewSchema = z
  .object({
    questions: z.array(questionSchema),
    log: z.array(interviewLogEntrySchema),
    analysis: blueprintAnalysisSchema.nullable(),
  })
  .refine((i) => new Set(i.questions.map((q) => q.id)).size === i.questions.length, {
    message: 'Fragen-IDs müssen eindeutig sein',
    path: ['questions'],
  })
export type Interview = z.infer<typeof interviewSchema>

export const projectSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1),
  name: projectNameSchema,
  entryPoint: entryPointSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  blueprint: blueprintSchema,
  interview: interviewSchema,
})
export type Project = z.infer<typeof projectSchema>
