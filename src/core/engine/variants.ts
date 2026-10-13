import {
  buildExpandProfileMessages,
  buildGenerateVariantsMessages,
  classificationSchema,
  EXPAND_PROFILE_PROMPT_ID,
  EXPAND_PROFILE_PROMPT_VERSION,
  GENERATE_VARIANTS_PROMPT_ID,
  GENERATE_VARIANTS_PROMPT_VERSION,
  MAX_PROFILE_FEATURES,
  MAX_PROFILE_RISKS,
  MAX_VARIANTS,
  MIN_VARIANTS,
  variantsResultSchema,
  type Classification,
  type VariantCandidate,
} from '@/core/ai/prompts'
import { generateStructured } from '@/core/ai/structured'
import type { AiProvider, CompletionResult } from '@/core/ai/types'
import { PROJECT_NAME_MAX_LENGTH, type Project, type ProjectProfile } from '@/core/blueprint/schema'
import {
  applyClassification,
  MAX_IDEA_TEXT_LENGTH,
  type ApplyClassificationResult,
} from './classification'
import { cleanTextList, normalizeText } from './cleaning'

type Language = 'de' | 'en'

/** Ein bereinigter Steckbrief der KI samt Titel, bereit für einen Eintrag. */
export interface VariantDraft {
  name: string
  profile: ProjectProfile
}

export interface GenerateVariantsOptions {
  provider: AiProvider
  idea: string
  /** Gewünschte Zahl an Varianten; wird auf 1 bis 3 begrenzt. */
  count: number
  language: Language
  temperature?: number
  signal?: AbortSignal
}

export interface GenerateVariantsResult {
  candidates: VariantCandidate[]
  calls: CompletionResult[]
  promptId: string
  promptVersion: number
}

/** Begrenzt die gewünschte Zahl an Varianten auf 1 bis 3. */
export function clampVariantCount(count: number): number {
  if (!Number.isFinite(count)) return MIN_VARIANTS
  return Math.min(MAX_VARIANTS, Math.max(MIN_VARIANTS, Math.round(count)))
}

/** Lässt die KI aus einer Idee ein bis drei Steckbriefe erzeugen. */
export async function generateVariants({
  provider,
  idea,
  count,
  language,
  temperature = 0.9,
  signal,
}: GenerateVariantsOptions): Promise<GenerateVariantsResult> {
  const trimmed = idea.trim()
  if (!trimmed) throw new RangeError('Die Idee für die Varianten ist leer')
  if (trimmed.length > MAX_IDEA_TEXT_LENGTH) {
    throw new RangeError(`Die Idee ist länger als ${MAX_IDEA_TEXT_LENGTH} Zeichen`)
  }

  const { data, calls } = await generateStructured({
    provider,
    schema: variantsResultSchema,
    name: 'project_variants',
    messages: buildGenerateVariantsMessages({
      idea: trimmed,
      count: clampVariantCount(count),
      language,
    }),
    temperature,
    signal,
  })
  return {
    candidates: data.variants,
    calls,
    promptId: GENERATE_VARIANTS_PROMPT_ID,
    promptVersion: GENERATE_VARIANTS_PROMPT_VERSION,
  }
}

const stripBullet = (text: string) => text.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')

/**
 * Bereinigt die Varianten der KI: Varianten ohne Titel oder Pitch und doppelte Titel entfallen,
 * Funktionen (höchstens 8) und Risiken (höchstens 3) werden bereinigt und gekürzt, Texte getrimmt.
 * Weniger als 5 Funktionen oder 2 Risiken bleiben, wie sie sind; erfunden wird nichts.
 */
export function applyVariantCandidates(
  candidates: readonly VariantCandidate[],
  { limit }: { limit: number },
): VariantDraft[] {
  const seen = new Set<string>()
  const drafts: VariantDraft[] = []
  for (const candidate of candidates) {
    // Der Titel wird Projektname und muss dessen Höchstlänge einhalten.
    const name = candidate.title
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, PROJECT_NAME_MAX_LENGTH)
      .trim()
    const pitch = candidate.pitch.trim()
    const key = normalizeText(name)
    if (!name || !pitch || seen.has(key)) continue
    seen.add(key)
    drafts.push({
      name,
      profile: {
        pitch,
        problem: candidate.problem.trim(),
        audience: candidate.audience.trim(),
        features: cleanTextList(candidate.features.map(stripBullet), MAX_PROFILE_FEATURES),
        platform: candidate.platform.trim(),
        monetization: {
          model: candidate.monetization.model.trim(),
          priceRange: candidate.monetization.priceRange.trim(),
          reason: candidate.monetization.reason.trim(),
        },
        effort: candidate.effort,
        risks: cleanTextList(candidate.risks.map(stripBullet), MAX_PROFILE_RISKS),
      },
    })
    if (drafts.length >= limit) break
  }
  return drafts
}

/**
 * Macht ein (frisch angelegtes) Projekt zum Eintrag mit Steckbrief. Die Abschnitte bleiben leer;
 * sie füllt erst „Voll ausarbeiten“ (`expandEntry`).
 */
export function applyProfile(project: Project, { name, profile }: VariantDraft): Project {
  return { ...project, name, profile, entryPoint: project.entryPoint ?? 'partialIdea' }
}

export interface ExpandProfileOptions {
  provider: AiProvider
  project: Project
  language: Language
  temperature?: number
  signal?: AbortSignal
}

export interface ExpandProfileResult {
  classification: Classification
  calls: CompletionResult[]
  promptId: string
  promptVersion: number
}

/** Lässt die KI aus dem Steckbrief eines Eintrags alle zehn Abschnitte ausschreiben. */
export async function expandProfile({
  provider,
  project,
  language,
  temperature = 0.4,
  signal,
}: ExpandProfileOptions): Promise<ExpandProfileResult> {
  if (!project.profile) throw new RangeError('Der Eintrag hat keinen Steckbrief')

  const { data, calls } = await generateStructured({
    provider,
    schema: classificationSchema,
    name: 'profile_expansion',
    messages: buildExpandProfileMessages({
      name: project.name,
      profile: project.profile,
      language,
    }),
    temperature,
    signal,
  })
  return {
    classification: data,
    calls,
    promptId: EXPAND_PROFILE_PROMPT_ID,
    promptVersion: EXPAND_PROFILE_PROMPT_VERSION,
  }
}

/**
 * Übernimmt die ausgeschriebenen Abschnitte in den Eintrag. Sie landen über `applyClassification`
 * als Vorschlag (`aiSuggestion`); eigener Inhalt bleibt unangetastet, der Name bleibt.
 */
export function expandEntry(
  project: Project,
  classification: Classification,
): ApplyClassificationResult {
  return applyClassification(project, classification, project.entryPoint ?? 'partialIdea')
}
