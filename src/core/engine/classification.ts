import {
  buildClassifyIdeaMessages,
  CLASSIFY_IDEA_PROMPT_ID,
  CLASSIFY_IDEA_PROMPT_VERSION,
  classificationSchema,
  type Classification,
} from '@/core/ai/prompts'
import { generateStructured } from '@/core/ai/structured'
import type { AiProvider, CompletionResult } from '@/core/ai/types'
import { projectNameSchema, type EntryPoint, type Project } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'

/** Obergrenze für eingefügte Texte, damit Kosten und Kontextlänge im Rahmen bleiben. */
export const MAX_IDEA_TEXT_LENGTH = 20_000

export interface ClassifyIdeaOptions {
  provider: AiProvider
  text: string
  entryPoint: EntryPoint
  language: 'de' | 'en'
  temperature?: number
  signal?: AbortSignal
}

export interface ClassifyIdeaResult {
  classification: Classification
  calls: CompletionResult[]
  promptId: string
  promptVersion: number
}

/** Lässt die KI einen Freitext den Blueprint-Abschnitten zuordnen. */
export async function classifyIdea({
  provider,
  text,
  entryPoint,
  language,
  temperature = 0.2,
  signal,
}: ClassifyIdeaOptions): Promise<ClassifyIdeaResult> {
  const trimmed = text.trim()
  if (!trimmed) throw new RangeError('Der Text für die Einordnung ist leer')
  if (trimmed.length > MAX_IDEA_TEXT_LENGTH) {
    throw new RangeError(`Der Text ist länger als ${MAX_IDEA_TEXT_LENGTH} Zeichen`)
  }

  const { data, calls } = await generateStructured({
    provider,
    schema: classificationSchema,
    name: 'idea_classification',
    messages: buildClassifyIdeaMessages({ text: trimmed, entryPoint, language }),
    temperature,
    signal,
  })
  return {
    classification: data,
    calls,
    promptId: CLASSIFY_IDEA_PROMPT_ID,
    promptVersion: CLASSIFY_IDEA_PROMPT_VERSION,
  }
}

export interface ApplyClassificationOptions {
  /** Projektnamen durch den Vorschlag der KI ersetzen (nur wenn der Nutzer keinen Namen vergeben hat). */
  useSuggestedName?: boolean
}

export interface ApplyClassificationResult {
  project: Project
  /** Abschnitte, die mit KI-Inhalt gefüllt wurden. */
  updated: SectionId[]
  /** Abschnitte, bei denen eigener Inhalt des Nutzers Vorrang hatte. */
  kept: SectionId[]
}

/**
 * Überträgt eine Einordnung in ein Projekt. Eigener Inhalt des Nutzers wird nie überschrieben;
 * KI-Inhalte landen als Vorschlag (`aiSuggestion`) und müssen bestätigt werden.
 */
export function applyClassification(
  project: Project,
  classification: Classification,
  entryPoint: EntryPoint,
  { useSuggestedName = false }: ApplyClassificationOptions = {},
): ApplyClassificationResult {
  const sections = { ...project.blueprint.sections }
  const updated: SectionId[] = []
  const kept: SectionId[] = []

  for (const suggestion of classification.sections) {
    const content = suggestion.content.trim()
    if (suggestion.maturity === 'empty' || content === '') continue

    const current = sections[suggestion.id]
    if (current.source === 'user' && current.content.trim() !== '') {
      kept.push(suggestion.id)
      continue
    }
    sections[suggestion.id] = {
      ...current,
      content,
      maturity: suggestion.maturity,
      source: 'aiSuggestion',
    }
    updated.push(suggestion.id)
  }

  const suggestedName = projectNameSchema.safeParse(classification.projectName ?? '')
  const name = useSuggestedName && suggestedName.success ? suggestedName.data : project.name

  return { project: { ...project, name, entryPoint, blueprint: { sections } }, updated, kept }
}
