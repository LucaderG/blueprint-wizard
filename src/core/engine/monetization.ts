import {
  buildSuggestMonetizationModelsMessages,
  buildSuggestPricingStrategiesMessages,
  MAX_MODEL_CANDIDATES,
  MAX_PRICING_CANDIDATES,
  monetizationModelsResultSchema,
  pricingStrategiesResultSchema,
  SUGGEST_MONETIZATION_MODELS_PROMPT_ID,
  SUGGEST_MONETIZATION_MODELS_PROMPT_VERSION,
  SUGGEST_PRICING_STRATEGIES_PROMPT_ID,
  SUGGEST_PRICING_STRATEGIES_PROMPT_VERSION,
  type MonetizationModelsResult,
  type PricingStrategiesResult,
} from '@/core/ai/prompts'
import { generateStructured } from '@/core/ai/structured'
import type { AiProvider, CompletionResult } from '@/core/ai/types'
import { computeCompleteness } from '@/core/blueprint/completeness'
import { updateSection } from '@/core/blueprint/editing'
import {
  MAX_CHOSEN_MODELS,
  MAX_CHOSEN_PRICING,
  MONETIZATION_CRITERIA,
  type Monetization,
  type MonetizationModel,
  type MonetizationModelKind,
  type MonetizationScores,
  type PricingOption,
  type PricingStrategyKind,
  type Project,
} from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import { cleanTextList, normalizeText } from './cleaning'

/** Ab dieser Vollständigkeit (Prozent) wird die Sektion angeboten. */
export const MONETIZATION_MIN_COMPLETENESS = 60
/** Diese Abschnitte müssen Inhalt haben, damit Vorschläge eine Grundlage haben. */
export const MONETIZATION_REQUIRED_SECTIONS = ['problem', 'audience', 'features'] as const
/** Höchstzahl an Gegengründen pro Modell. */
export const MAX_MODEL_CONCERNS = 3

/** Fehler bei einer ungültigen Aktion in der Monetarisierung (z. B. unbekannte ID). */
export class MonetizationError extends Error {
  override name = 'MonetizationError'
}

type Language = 'de' | 'en'

export function emptyMonetization(): Monetization {
  return {
    models: [],
    chosenModelIds: [],
    modelRationale: '',
    pricingOptions: [],
    chosenPricingIds: [],
    pricingRationale: '',
    status: 'open',
    decidedAt: null,
  }
}

const current = (project: Project): Monetization => project.monetization ?? emptyMonetization()

const withMonetization = (project: Project, monetization: Monetization): Project => ({
  ...project,
  monetization,
})

// ---------------------------------------------------------------------------
// Freischaltung
// ---------------------------------------------------------------------------

export interface MonetizationAvailability {
  /** Empfohlen: Blueprint weit genug für fundierte Vorschläge. Öffnen geht trotzdem immer. */
  available: boolean
  completeness: number
  belowThreshold: boolean
  /** Pflichtabschnitte ohne Inhalt (Reihenfolge wie `MONETIZATION_REQUIRED_SECTIONS`). */
  missingSections: SectionId[]
}

export function monetizationAvailability(project: Project): MonetizationAvailability {
  const completeness = computeCompleteness(project.blueprint).total
  const missingSections = MONETIZATION_REQUIRED_SECTIONS.filter(
    (id) => !project.blueprint.sections[id].content.trim(),
  )
  const belowThreshold = completeness < MONETIZATION_MIN_COMPLETENESS
  return {
    available: !belowThreshold && missingSections.length === 0,
    completeness,
    belowThreshold,
    missingSections,
  }
}

// ---------------------------------------------------------------------------
// Ableitungen
// ---------------------------------------------------------------------------

/** Die gewählten Modelle in Auswahlreihenfolge. */
export function chosenModels(monetization: Monetization): MonetizationModel[] {
  return monetization.chosenModelIds.flatMap((id) => {
    const model = monetization.models.find((m) => m.id === id)
    return model ? [model] : []
  })
}

/** Die gewählten Preisstrategien in Auswahlreihenfolge. */
export function chosenPricing(monetization: Monetization): PricingOption[] {
  return monetization.chosenPricingIds.flatMap((id) => {
    const option = monetization.pricingOptions.find((o) => o.id === id)
    return option ? [option] : []
  })
}

/** Eine Preisstrategie braucht es nur, wenn Modelle gewählt sind und nicht „nicht monetarisieren“. */
export function needsPricing(monetization: Monetization): boolean {
  const models = chosenModels(monetization)
  return models.length > 0 && !models.some((m) => m.kind === 'none')
}

function requirePricing(monetization: Monetization): void {
  if (!needsPricing(monetization)) {
    throw new MonetizationError('Preisstrategien brauchen ein gewähltes Bezahlmodell')
  }
}

/** Kann die Sektion abgeschlossen werden? */
export function canFinalize(monetization: Monetization): boolean {
  if (monetization.chosenModelIds.length === 0) return false
  return !needsPricing(monetization) || monetization.chosenPricingIds.length > 0
}

export type CombinationWarningCode =
  'adsWithLicense' | 'oneTimeWithSubscription' | 'inAppWithLicense'

export interface CombinationWarning {
  code: CombinationWarningCode
  kinds: [MonetizationModelKind, MonetizationModelKind]
}

/** Kombinationen, die selten zusammenpassen. Hinweise, keine Sperre. */
const SOFT_CONFLICTS: readonly CombinationWarning[] = [
  { code: 'adsWithLicense', kinds: ['ads', 'license'] },
  { code: 'oneTimeWithSubscription', kinds: ['oneTime', 'subscription'] },
  { code: 'inAppWithLicense', kinds: ['inAppPurchase', 'license'] },
]

/** Hinweise zu einer (geplanten) Kombination von Modellen. */
export function combinationWarnings(kinds: readonly MonetizationModelKind[]): CombinationWarning[] {
  const set = new Set(kinds)
  return SOFT_CONFLICTS.filter(({ kinds: [a, b] }) => set.has(a) && set.has(b))
}

/** „Nicht monetarisieren“ lässt sich mit keinem anderen Modell kombinieren. */
export function isValidCombination(kinds: readonly MonetizationModelKind[]): boolean {
  return kinds.length <= 1 || !kinds.includes('none')
}

export type ImpactCode =
  | 'payments'
  | 'accounts'
  | 'usageMetering'
  | 'adNetwork'
  | 'adPrivacy'
  | 'payouts'
  | 'storeFees'
  | 'licenseKeys'
  | 'openSourceLicense'

export interface MonetizationImpact {
  code: ImpactCode
  sectionId: SectionId
}

const IMPACT_SECTION: Record<ImpactCode, SectionId> = {
  payments: 'integrations',
  accounts: 'dataModel',
  usageMetering: 'dataModel',
  adNetwork: 'integrations',
  adPrivacy: 'risks',
  payouts: 'integrations',
  storeFees: 'risks',
  licenseKeys: 'features',
  openSourceLicense: 'risks',
}

const IMPACTS_BY_KIND: Record<MonetizationModelKind, readonly ImpactCode[]> = {
  oneTime: ['payments', 'licenseKeys'],
  subscription: ['payments', 'accounts'],
  freemium: ['payments', 'accounts'],
  usageBased: ['payments', 'accounts', 'usageMetering'],
  ads: ['adNetwork', 'adPrivacy'],
  commission: ['payments', 'accounts', 'payouts'],
  inAppPurchase: ['payments', 'storeFees'],
  license: ['payments', 'accounts', 'licenseKeys'],
  openCore: ['openSourceLicense', 'payments'],
  none: [],
}

/**
 * Was die gewählten Modelle für andere Abschnitte bedeuten (regelbasiert, ohne KI).
 * Jede Auswirkung kommt höchstens einmal vor, in der Reihenfolge der Modelle.
 */
export function monetizationImpacts(monetization: Monetization): MonetizationImpact[] {
  const codes = new Set<ImpactCode>()
  for (const model of chosenModels(monetization)) {
    for (const code of IMPACTS_BY_KIND[model.kind]) codes.add(code)
  }
  return [...codes].map((code) => ({ code, sectionId: IMPACT_SECTION[code] }))
}

// ---------------------------------------------------------------------------
// KI-Vorschläge
// ---------------------------------------------------------------------------

export interface MonetizationAiOptions {
  provider: AiProvider
  project: Project
  language: Language
  temperature?: number
  signal?: AbortSignal
}

export interface MonetizationAiResult<T> {
  result: T
  calls: CompletionResult[]
  promptId: string
  promptVersion: number
}

/** Lässt die KI passende Monetarisierungsmodelle vorstellen und bewerten. */
export async function suggestMonetizationModels({
  provider,
  project,
  language,
  temperature = 0.4,
  signal,
}: MonetizationAiOptions): Promise<MonetizationAiResult<MonetizationModelsResult>> {
  const { data, calls } = await generateStructured({
    provider,
    schema: monetizationModelsResultSchema,
    name: 'monetization_models',
    messages: buildSuggestMonetizationModelsMessages({ project, language }),
    temperature,
    signal,
  })
  return {
    result: data,
    calls,
    promptId: SUGGEST_MONETIZATION_MODELS_PROMPT_ID,
    promptVersion: SUGGEST_MONETIZATION_MODELS_PROMPT_VERSION,
  }
}

/** Lässt die KI Preisstrategien zu den gewählten Modellen vorschlagen. */
export async function suggestPricingStrategies({
  provider,
  project,
  language,
  temperature = 0.4,
  signal,
}: MonetizationAiOptions): Promise<MonetizationAiResult<PricingStrategiesResult>> {
  const monetization = current(project)
  requirePricing(monetization)
  const { data, calls } = await generateStructured({
    provider,
    schema: pricingStrategiesResultSchema,
    name: 'pricing_strategies',
    messages: buildSuggestPricingStrategiesMessages({
      project: { ...project, monetization },
      language,
    }),
    temperature,
    signal,
  })
  return {
    result: data,
    calls,
    promptId: SUGGEST_PRICING_STRATEGIES_PROMPT_ID,
    promptVersion: SUGGEST_PRICING_STRATEGIES_PROMPT_VERSION,
  }
}

export interface ApplyCandidatesOptions {
  createId?: () => string
}

/** Ganze Zahl von 1 bis 5; `null`, wenn keine Zahl vorliegt. */
function clampScore(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null
  return Math.min(5, Math.max(1, Math.round(value)))
}

/** Fehlt eine Bewertung, wird keine erfunden: Das Modell gilt dann als unbewertet (`null`). */
function cleanScores(scores: Record<string, number>): MonetizationScores | null {
  const cleaned: Partial<Record<string, number>> = {}
  for (const criterion of MONETIZATION_CRITERIA) {
    const score = clampScore(scores[criterion])
    if (score === null) return null
    cleaned[criterion] = score
  }
  return cleaned as MonetizationScores
}

/**
 * Übernimmt vorgeschlagene Modelle.
 * - Gewählte Modelle bleiben erhalten; alle anderen werden ersetzt.
 * - Jedes Modell (kind) höchstens einmal; ein schon gewähltes geht vor.
 * - Ohne Beschreibung entfällt ein Kandidat; höchstens `MAX_MODEL_CANDIDATES` neue.
 * - Texte werden getrimmt, Bewertungen auf 1–5 begrenzt (unvollständige entfallen), höchstens drei
 *   Gegengründe.
 */
export function applyModelCandidates(
  project: Project,
  result: MonetizationModelsResult,
  { createId = () => crypto.randomUUID() }: ApplyCandidatesOptions = {},
): Project {
  const monetization = current(project)
  const kept = chosenModels(monetization)
  const kinds = new Set(kept.map((m) => m.kind))

  const added: MonetizationModel[] = []
  for (const candidate of result.models) {
    const summary = candidate.summary.trim()
    if (!summary || kinds.has(candidate.kind) || added.length >= MAX_MODEL_CANDIDATES) continue
    kinds.add(candidate.kind)
    added.push({
      id: createId(),
      kind: candidate.kind,
      title: candidate.title.trim(),
      summary,
      fitReason: candidate.fitReason.trim(),
      concerns: cleanTextList(candidate.concerns, MAX_MODEL_CONCERNS),
      scores: cleanScores(candidate.scores),
      recommended: candidate.recommended,
    })
  }

  return withMonetization(project, { ...monetization, models: [...kept, ...added] })
}

/** Ergänzt ein Modell von Hand (ohne KI-Bewertung). Ist es schon vorhanden, bleibt alles, wie es ist. */
export function addManualModel(
  project: Project,
  kind: MonetizationModelKind,
  createId: () => string = () => crypto.randomUUID(),
): Project {
  const monetization = current(project)
  if (monetization.models.some((m) => m.kind === kind)) return project
  const model: MonetizationModel = {
    id: createId(),
    kind,
    title: '',
    summary: '',
    fitReason: '',
    concerns: [],
    scores: null,
    recommended: false,
  }
  return withMonetization(project, { ...monetization, models: [...monetization.models, model] })
}

/**
 * Legt die gewählten Modelle fest. Ändert sich die Auswahl, sind die bisherigen Preisstrategien
 * hinfällig (sie hingen an den alten Modellen) und die Sektion ist wieder offen.
 */
export function chooseModels(
  project: Project,
  modelIds: readonly string[],
  rationale: string,
): Project {
  const monetization = current(project)
  const ids = [...new Set(modelIds)]
  if (ids.length === 0) throw new MonetizationError('Mindestens ein Modell wählen')
  if (ids.length > MAX_CHOSEN_MODELS) {
    throw new MonetizationError(`Höchstens ${MAX_CHOSEN_MODELS} Modelle kombinieren`)
  }
  const models = ids.map((id) => {
    const model = monetization.models.find((m) => m.id === id)
    if (!model) throw new MonetizationError(`Unbekanntes Modell: ${id}`)
    return model
  })
  if (!isValidCombination(models.map((m) => m.kind))) {
    throw new MonetizationError('„Nicht monetarisieren“ lässt sich nicht kombinieren')
  }

  const sameSelection =
    ids.length === monetization.chosenModelIds.length &&
    ids.every((id) => monetization.chosenModelIds.includes(id))
  const pricing = sameSelection
    ? {}
    : { pricingOptions: [], chosenPricingIds: [], pricingRationale: '' }
  return withMonetization(project, {
    ...monetization,
    ...pricing,
    chosenModelIds: ids,
    modelRationale: rationale.trim(),
    status: 'open',
    decidedAt: null,
  })
}

/**
 * Übernimmt vorgeschlagene Preisstrategien.
 * - Gewählte Strategien bleiben erhalten; alle anderen werden ersetzt.
 * - Jede Strategie höchstens einmal; ohne Beschreibung entfällt ein Kandidat.
 * - Höchstens `MAX_PRICING_CANDIDATES` neue.
 */
export function applyPricingCandidates(
  project: Project,
  result: PricingStrategiesResult,
  { createId = () => crypto.randomUUID() }: ApplyCandidatesOptions = {},
): Project {
  const monetization = current(project)
  requirePricing(monetization)
  const kept = chosenPricing(monetization)
  const strategies = new Set(kept.map((o) => o.strategy))

  const added: PricingOption[] = []
  for (const candidate of result.strategies) {
    const summary = candidate.summary.trim()
    if (!summary || strategies.has(candidate.strategy) || added.length >= MAX_PRICING_CANDIDATES) {
      continue
    }
    strategies.add(candidate.strategy)
    added.push({
      id: createId(),
      strategy: candidate.strategy,
      title: candidate.title.trim(),
      summary,
      examplePrices: candidate.examplePrices.trim(),
      reason: candidate.reason.trim(),
      recommended: candidate.recommended,
    })
  }

  return withMonetization(project, { ...monetization, pricingOptions: [...kept, ...added] })
}

/** Ergänzt eine Preisstrategie von Hand. Ist sie schon vorhanden, bleibt alles, wie es ist. */
export function addManualPricing(
  project: Project,
  strategy: PricingStrategyKind,
  createId: () => string = () => crypto.randomUUID(),
): Project {
  const monetization = current(project)
  requirePricing(monetization)
  if (monetization.pricingOptions.some((o) => o.strategy === strategy)) return project
  const option: PricingOption = {
    id: createId(),
    strategy,
    title: '',
    summary: '',
    examplePrices: '',
    reason: '',
    recommended: false,
  }
  return withMonetization(project, {
    ...monetization,
    pricingOptions: [...monetization.pricingOptions, option],
  })
}

/** Legt die Preisstrategie(n) fest; die Sektion ist danach wieder offen, bis sie abgeschlossen wird. */
export function choosePricing(
  project: Project,
  optionIds: readonly string[],
  rationale: string,
): Project {
  const monetization = current(project)
  requirePricing(monetization)
  const ids = [...new Set(optionIds)]
  if (ids.length === 0) throw new MonetizationError('Mindestens eine Preisstrategie wählen')
  if (ids.length > MAX_CHOSEN_PRICING) {
    throw new MonetizationError(`Höchstens ${MAX_CHOSEN_PRICING} Preisstrategien kombinieren`)
  }
  for (const id of ids) {
    if (!monetization.pricingOptions.some((o) => o.id === id)) {
      throw new MonetizationError(`Unbekannte Preisstrategie: ${id}`)
    }
  }
  return withMonetization(project, {
    ...monetization,
    chosenPricingIds: ids,
    pricingRationale: rationale.trim(),
    status: 'open',
    decidedAt: null,
  })
}

/**
 * Schließt die Sektion ab. Im Export steht das Kapitel schon vorher (mit Status „offen“), sobald ein
 * Modell gewählt ist; der Abschluss setzt den Status auf „entschieden“.
 */
export function finalizeMonetization(project: Project, now: Date): Project {
  const monetization = current(project)
  if (!canFinalize(monetization)) {
    throw new MonetizationError('Erst Modell und, falls nötig, Preisstrategie wählen')
  }
  return withMonetization(project, {
    ...monetization,
    status: 'decided',
    decidedAt: now.toISOString(),
  })
}

/** Öffnet eine abgeschlossene Sektion wieder; die Auswahl bleibt als Entwurf. */
export function reopenMonetization(project: Project): Project {
  const monetization = project.monetization
  if (!monetization || monetization.status === 'open') return project
  return withMonetization(project, { ...monetization, status: 'open', decidedAt: null })
}

/** Verwirft den gesamten Stand der Sektion. */
export function resetMonetization(project: Project): Project {
  return project.monetization === null ? project : { ...project, monetization: null }
}

const stripBullet = (line: string) =>
  line
    .trim()
    .replace(/^(?:[-*+]|\d+[.)])\s+/, '')
    .trim()

/** Steht der Hinweis schon als Zeile (mit oder ohne Aufzählungszeichen) im Abschnitt? */
export function hasImpactNote(project: Project, sectionId: SectionId, text: string): boolean {
  const note = normalizeText(stripBullet(text))
  return project.blueprint.sections[sectionId].content
    .split('\n')
    .some((line) => normalizeText(stripBullet(line)) === note)
}

/**
 * Hängt einen Hinweis als Stichpunkt an einen Abschnitt an. Steht er dort schon, bleibt alles, wie
 * es ist. Vorhandener Text wird nie verändert. Wie jede Bearbeitung von Hand wird der Abschnitt
 * dadurch eigener Inhalt (`user`), damit eine spätere KI-Einordnung den Punkt nicht überschreibt.
 */
export function appendImpactNote(project: Project, sectionId: SectionId, text: string): Project {
  const note = stripBullet(text)
  if (!note || hasImpactNote(project, sectionId, note)) return project
  const section = project.blueprint.sections[sectionId]
  const existing = section.content.trimEnd()
  return updateSection(project, sectionId, {
    content: existing ? `${existing}\n- ${note}` : `- ${note}`,
    source: 'user',
  })
}
