import { z } from 'zod'
import { SECTION_IDS, type SectionId } from './sections'

/** Aktuelle Version des gespeicherten Projektformats. Bei jeder Schemaänderung erhöhen und eine Migration ergänzen. */
export const CURRENT_SCHEMA_VERSION = 4

export const sectionIdSchema = z.enum(SECTION_IDS)

/** Reifegrad eines Abschnitts: leer → vage → entschieden. */
export const maturitySchema = z.enum(['empty', 'vague', 'decided'])
export type Maturity = z.infer<typeof maturitySchema>

/** Woher der aktuelle Inhalt eines Abschnitts stammt. */
export const sectionSourceSchema = z.enum(['user', 'aiSuggestion', 'aiAccepted'])
export type SectionSource = z.infer<typeof sectionSourceSchema>

/** Wie stark eine Frage oder Entscheidung das Projekt verändert (1 = Detail, 5 = Grundsatz). */
export const leverageSchema = z.number().int().min(1).max(5)

export const sectionSchema = z.object({
  id: sectionIdSchema,
  content: z.string(),
  maturity: maturitySchema,
  source: sectionSourceSchema,
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

export const decisionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  pros: z.array(z.string().min(1)),
  cons: z.array(z.string().min(1)),
  /** Was diese Wahl für das Projekt bedeutet (Folgen für Aufwand, Technik, Umfang). */
  consequence: z.string(),
})
export type DecisionOption = z.infer<typeof decisionOptionSchema>

/** `dismissed` = verworfen oder durch eine neue Ermittlung überholt. */
export const decisionStatusSchema = z.enum(['open', 'decided', 'dismissed'])
export type DecisionStatus = z.infer<typeof decisionStatusSchema>

export const decisionSchema = z
  .object({
    id: z.string().min(1),
    /** Abschnitt, den die Entscheidung vor allem prägt. */
    sectionId: sectionIdSchema,
    title: z.string().min(1),
    /** Warum die Entscheidung ansteht und was davon abhängt. */
    context: z.string(),
    leverage: leverageSchema,
    options: z.array(decisionOptionSchema).min(2),
    recommendedOptionId: z.string().nullable(),
    chosenOptionId: z.string().nullable(),
    /** Begründung der Wahl (Entscheidungsprotokoll). */
    rationale: z.string(),
    status: decisionStatusSchema,
    createdAt: z.iso.datetime(),
    decidedAt: z.iso.datetime().nullable(),
  })
  .refine((d) => (d.status === 'decided') === (d.chosenOptionId !== null), {
    message: 'Nur entschiedene Entscheidungen haben eine gewählte Option',
    path: ['chosenOptionId'],
  })
  .refine((d) => (d.status === 'decided') === (d.decidedAt !== null), {
    message: 'Nur entschiedene Entscheidungen haben einen Zeitpunkt',
    path: ['decidedAt'],
  })
  .refine(
    (d) =>
      [d.chosenOptionId, d.recommendedOptionId].every(
        (id) => id === null || d.options.some((o) => o.id === id),
      ),
    { message: 'Option muss vorhanden sein', path: ['options'] },
  )
export type Decision = z.infer<typeof decisionSchema>

/** Abschnitte, für die der Vorschlagsmodus Ergänzungen macht. */
export const ADDITION_SECTION_IDS = ['features', 'nonGoals', 'risks'] as const
export const additionSectionIdSchema = z.enum(ADDITION_SECTION_IDS)
export type AdditionSectionId = z.infer<typeof additionSectionIdSchema>

/** Ein Ergänzungsvorschlag der KI (Vorschlagsmodus), einzeln annehmbar oder ablehnbar. */
export const additionSchema = z.object({
  id: z.string().min(1),
  sectionId: additionSectionIdSchema,
  text: z.string().min(1),
  reason: z.string(),
  status: z.enum(['open', 'accepted', 'rejected', 'dismissed']),
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
})
export type Addition = z.infer<typeof additionSchema>

const uniqueIds = (items: readonly { id: string }[]) =>
  new Set(items.map((item) => item.id)).size === items.length

/** Monetarisierungsmodelle, aus denen die KI und der Nutzer wählen. `none` = bewusst nicht monetarisieren. */
export const MONETIZATION_MODEL_KINDS = [
  'oneTime',
  'subscription',
  'freemium',
  'usageBased',
  'ads',
  'commission',
  'inAppPurchase',
  'license',
  'openCore',
  'none',
] as const
export const monetizationModelKindSchema = z.enum(MONETIZATION_MODEL_KINDS)
export type MonetizationModelKind = z.infer<typeof monetizationModelKindSchema>

/** Vergleichskriterien. Jede Bewertung läuft von 1 bis 5; 5 ist immer günstig für das Projekt. */
export const MONETIZATION_CRITERIA = [
  'revenuePotential',
  'implementationEase',
  'userAcceptance',
  'predictability',
  'audienceFit',
  'techFit',
] as const
export type MonetizationCriterion = (typeof MONETIZATION_CRITERIA)[number]

const scoreSchema = z.number().int().min(1).max(5)
export const monetizationScoresSchema = z.object(
  Object.fromEntries(MONETIZATION_CRITERIA.map((c) => [c, scoreSchema])) as Record<
    MonetizationCriterion,
    typeof scoreSchema
  >,
)
export type MonetizationScores = z.infer<typeof monetizationScoresSchema>

/** Höchstzahl gleichzeitig gewählter Modelle (eine sinnvolle Kombination). */
export const MAX_CHOSEN_MODELS = 3
/** Höchstzahl gleichzeitig gewählter Preisstrategien. */
export const MAX_CHOSEN_PRICING = 2

export const monetizationModelSchema = z.object({
  id: z.string().min(1),
  kind: monetizationModelKindSchema,
  /** Eigener Titel der KI; leer = Anzeigename des Modells. */
  title: z.string(),
  summary: z.string(),
  /** Warum das Modell zu diesem Projekt passt. */
  fitReason: z.string(),
  /** Gegengründe und Risiken. */
  concerns: z.array(z.string().min(1)),
  /** Bewertung nach `MONETIZATION_CRITERIA`; `null` bei von Hand ergänzten Modellen. */
  scores: monetizationScoresSchema.nullable(),
  recommended: z.boolean(),
})
export type MonetizationModel = z.infer<typeof monetizationModelSchema>

export const PRICING_STRATEGY_KINDS = [
  'tiers',
  'valueBased',
  'competitive',
  'penetration',
  'skimming',
  'perSeat',
  'anchor',
  'trialDiscount',
] as const
export const pricingStrategyKindSchema = z.enum(PRICING_STRATEGY_KINDS)
export type PricingStrategyKind = z.infer<typeof pricingStrategyKindSchema>

export const pricingOptionSchema = z.object({
  id: z.string().min(1),
  strategy: pricingStrategyKindSchema,
  title: z.string(),
  summary: z.string(),
  /** Beispielpreise als Spannen in Euro; immer eine Annahme, keine Marktdaten. */
  examplePrices: z.string(),
  reason: z.string(),
  recommended: z.boolean(),
})
export type PricingOption = z.infer<typeof pricingOptionSchema>

/** Stand der Monetarisierungs-Sektion eines Projekts. */
export const monetizationSchema = z
  .object({
    models: z.array(monetizationModelSchema),
    chosenModelIds: z.array(z.string().min(1)).max(MAX_CHOSEN_MODELS),
    modelRationale: z.string(),
    pricingOptions: z.array(pricingOptionSchema),
    chosenPricingIds: z.array(z.string().min(1)).max(MAX_CHOSEN_PRICING),
    pricingRationale: z.string(),
    status: z.enum(['open', 'decided']),
    decidedAt: z.iso.datetime().nullable(),
  })
  .refine((m) => uniqueIds(m.models) && uniqueIds(m.pricingOptions), {
    message: 'IDs müssen eindeutig sein',
    path: ['models'],
  })
  .refine((m) => new Set(m.models.map((model) => model.kind)).size === m.models.length, {
    message: 'Jedes Modell darf nur einmal vorkommen',
    path: ['models'],
  })
  .refine(
    (m) =>
      m.chosenModelIds.every((id) => m.models.some((model) => model.id === id)) &&
      new Set(m.chosenModelIds).size === m.chosenModelIds.length,
    { message: 'Gewählte Modelle müssen vorhanden sein', path: ['chosenModelIds'] },
  )
  .refine(
    (m) =>
      m.chosenPricingIds.every((id) => m.pricingOptions.some((option) => option.id === id)) &&
      new Set(m.chosenPricingIds).size === m.chosenPricingIds.length,
    { message: 'Gewählte Preisstrategien müssen vorhanden sein', path: ['chosenPricingIds'] },
  )
  .refine(
    (m) =>
      m.chosenModelIds.length <= 1 ||
      !m.models.some((model) => model.kind === 'none' && m.chosenModelIds.includes(model.id)),
    { message: '„Nicht monetarisieren“ lässt sich nicht kombinieren', path: ['chosenModelIds'] },
  )
  .refine((m) => (m.status === 'decided') === (m.decidedAt !== null), {
    message: 'Nur abgeschlossene Monetarisierung hat einen Zeitpunkt',
    path: ['decidedAt'],
  })
  .refine((m) => m.status === 'open' || m.chosenModelIds.length > 0, {
    message: 'Abgeschlossen nur mit gewähltem Modell',
    path: ['status'],
  })
export type Monetization = z.infer<typeof monetizationSchema>

export const projectSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1),
  name: projectNameSchema,
  entryPoint: entryPointSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  blueprint: blueprintSchema,
  interview: interviewSchema,
  decisions: z.array(decisionSchema).refine(uniqueIds, 'Entscheidungs-IDs müssen eindeutig sein'),
  additions: z.array(additionSchema).refine(uniqueIds, 'Vorschlags-IDs müssen eindeutig sein'),
  /** Monetarisierung (seit Schema 4); `null`, solange die Sektion nicht begonnen wurde. */
  monetization: monetizationSchema.nullable(),
})
export type Project = z.infer<typeof projectSchema>
