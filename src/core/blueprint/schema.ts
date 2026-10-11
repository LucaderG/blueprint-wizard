import { z } from 'zod'
import { SECTION_IDS, type SectionId } from './sections'

/** Aktuelle Version des gespeicherten Projektformats. Bei jeder Schemaänderung erhöhen und eine Migration ergänzen. */
export const CURRENT_SCHEMA_VERSION = 1

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

export const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  leverage: leverageSchema,
  status: z.enum(['open', 'answered', 'deferred']),
  answer: z.string().nullable(),
})
export type Question = z.infer<typeof questionSchema>

export const sectionSchema = z.object({
  id: sectionIdSchema,
  content: z.string(),
  maturity: maturitySchema,
  source: sectionSourceSchema,
  decisions: z.array(decisionSchema),
  questions: z.array(questionSchema),
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

export const projectSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1),
  name: projectNameSchema,
  entryPoint: entryPointSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  blueprint: blueprintSchema,
})
export type Project = z.infer<typeof projectSchema>
