import {
  buildGenerateIdeasMessages,
  GENERATE_IDEAS_PROMPT_ID,
  GENERATE_IDEAS_PROMPT_VERSION,
  ideaCountFor,
  ideasResultSchema,
  type IdeaCandidate,
  type IdeaRequest,
} from '@/core/ai/prompts'
import type { Classification } from '@/core/ai/prompts'
import { generateStructured } from '@/core/ai/structured'
import type { AiProvider, CompletionResult } from '@/core/ai/types'
import { acceptSuggestion } from '@/core/blueprint/editing'
import { PROJECT_NAME_MAX_LENGTH, type Project } from '@/core/blueprint/schema'
import { normalizeProfile, type IdeationProfile } from '@/core/ideation/profile'
import type { Idea, IdeationSession } from '@/core/ideation/session'
import { applyClassification } from './classification'
import { clampLeverage, cleanTextList, normalizeText } from './cleaning'
import type { VariantDraft } from './variants'

/** Höchstzahl an Ideen, die gleichzeitig angezeigt werden. */
export const MAX_IDEAS = 5
/** Höchstzahl an Kernfunktionen pro Idee. */
export const MAX_IDEA_FEATURES = 6
/** So viele schon gezeigte Titel merkt sich die Sitzung höchstens (hält den Prompt kurz). */
export const MAX_SEEN_TITLES = 40

type Language = 'de' | 'en'

export interface GenerateIdeasOptions {
  provider: AiProvider
  profile: IdeationProfile
  request: IdeaRequest
  avoidTitles: readonly string[]
  language: Language
  temperature?: number
  signal?: AbortSignal
}

export interface GenerateIdeasResult {
  candidates: IdeaCandidate[]
  calls: CompletionResult[]
  promptId: string
  promptVersion: number
}

/** Lässt die KI Ideen erzeugen, abwandeln oder kombinieren. */
export async function generateIdeas({
  provider,
  profile,
  request,
  avoidTitles,
  language,
  temperature = 0.9,
  signal,
}: GenerateIdeasOptions): Promise<GenerateIdeasResult> {
  const { data, calls } = await generateStructured({
    provider,
    schema: ideasResultSchema,
    name: 'project_ideas',
    messages: buildGenerateIdeasMessages({
      profile: normalizeProfile(profile),
      request,
      avoidTitles,
      language,
    }),
    temperature,
    signal,
  })
  return {
    candidates: data.ideas,
    calls,
    promptId: GENERATE_IDEAS_PROMPT_ID,
    promptVersion: GENERATE_IDEAS_PROMPT_VERSION,
  }
}

export interface CleanIdeasOptions {
  /** Höchstzahl an Ideen. */
  limit: number
  /** Titel, die nicht (noch einmal) vorkommen dürfen. */
  avoidTitles?: readonly string[]
  createId?: () => string
}

/**
 * Bereinigt Ideen der KI: Ideen ohne Titel oder Kurzbeschreibung und doppelte Titel entfallen,
 * Werte werden auf 1–5 begrenzt, Kernfunktionen bereinigt und gekürzt.
 */
export function cleanIdeaCandidates(
  candidates: readonly IdeaCandidate[],
  { limit, avoidTitles = [], createId = () => crypto.randomUUID() }: CleanIdeasOptions,
): Idea[] {
  const seen = new Set(avoidTitles.map(normalizeText))
  const ideas: Idea[] = []
  for (const candidate of candidates) {
    // Der Titel wird später Projektname und muss dessen Höchstlänge einhalten.
    const title = candidate.title
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, PROJECT_NAME_MAX_LENGTH)
      .trim()
    const pitch = candidate.pitch.trim()
    const key = normalizeText(title)
    if (!title || !pitch || seen.has(key)) continue
    seen.add(key)
    ideas.push({
      id: createId(),
      title,
      pitch,
      problem: candidate.problem.trim(),
      audience: candidate.audience.trim(),
      features: cleanTextList(
        candidate.features.map((f) => f.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')),
        MAX_IDEA_FEATURES,
      ),
      platform: candidate.platform.trim(),
      effort: candidate.effort,
      novelty: clampLeverage(candidate.novelty),
      learningValue: clampLeverage(candidate.learningValue),
      learningNote: candidate.learningNote.trim(),
    })
    if (ideas.length >= limit) break
  }
  return ideas
}

/**
 * Titel, die das Ergebnis dieser Anfrage nicht haben darf. Neue Runden meiden alle bisher gezeigten
 * Titel. Abgewandelte oder kombinierte Ideen dürfen ihren Ausgangsideen ähneln, aber nicht einer
 * anderen Karte gleichen (sonst stünden zwei gleichnamige Ideen nebeneinander).
 */
export function titlesToAvoid(session: IdeationSession, request: IdeaRequest): string[] {
  if (request.kind === 'refine') {
    return session.ideas.filter((i) => i.id !== request.idea.id).map((i) => i.title)
  }
  if (request.kind === 'combine') {
    const sourceIds = request.ideas.map((i) => i.id)
    return session.ideas.filter((i) => !sourceIds.includes(i.id)).map((i) => i.title)
  }
  return session.seenTitles
}

/**
 * Kürzt auf `MAX_IDEAS` und streicht dabei zuerst hinten Ideen, die nicht in `keepIds` stehen. So bleiben
 * etwa beim Kombinieren die neue Idee und beide Ausgangsideen erhalten.
 */
function keepWithin(ideas: readonly Idea[], keepIds: readonly string[]): Idea[] {
  const result = [...ideas]
  for (let i = result.length - 1; i >= 0 && result.length > MAX_IDEAS; i--) {
    if (!keepIds.includes(result[i]?.id ?? '')) result.splice(i, 1)
  }
  return result
}

/**
 * Baut das Ergebnis einer Anfrage in die Sitzung ein:
 * - `generate`: die neuen Ideen ersetzen die Liste.
 * - `moreLike`: das Vorbild bleibt vorn, dahinter die neuen Ideen.
 * - `refine`: die abgewandelte Idee ersetzt die ursprüngliche an derselben Stelle.
 * - `combine`: die kombinierte Idee kommt nach vorn; die beiden Ausgangsideen bleiben.
 * Liefert die KI nichts Brauchbares, bleibt die Liste unverändert.
 */
export function applyIdeas(
  session: IdeationSession,
  request: IdeaRequest,
  candidates: readonly IdeaCandidate[],
  { createId }: { createId?: () => string } = {},
): IdeationSession {
  const ideas = cleanIdeaCandidates(candidates, {
    limit: ideaCountFor(request),
    avoidTitles: titlesToAvoid(session, request),
    createId,
  })
  if (ideas.length === 0) return session

  let next: Idea[]
  switch (request.kind) {
    case 'generate':
      next = ideas
      break
    case 'moreLike': {
      const source = session.ideas.find((i) => i.id === request.idea.id) ?? request.idea
      next = [source, ...ideas]
      break
    }
    case 'refine': {
      const [refined] = ideas as [Idea]
      const index = session.ideas.findIndex((i) => i.id === request.idea.id)
      next =
        index === -1
          ? keepWithin([refined, ...session.ideas], [refined.id])
          : session.ideas.map((idea, i) => (i === index ? refined : idea))
      break
    }
    case 'combine':
      next = keepWithin(
        [...ideas, ...session.ideas],
        [...ideas.map((i) => i.id), ...request.ideas.map((i) => i.id)],
      )
      break
  }

  const seenTitles = cleanTextList([...session.seenTitles, ...ideas.map((i) => i.title)]).slice(
    -MAX_SEEN_TITLES,
  )
  return { ...session, ideas: next.slice(0, MAX_IDEAS), seenTitles }
}

/** Überträgt eine Idee in die Form der Einordnung, damit sie wie eine eingegebene Idee startet. */
export function ideaToClassification(idea: Idea): Classification {
  const problem = [idea.pitch, idea.problem].filter((text) => text.trim() !== '').join('\n\n')
  const features = idea.features.map((f) => `- ${f}`).join('\n')
  const sections: Classification['sections'] = [
    { id: 'problem', content: problem, maturity: 'vague' },
    { id: 'audience', content: idea.audience, maturity: 'vague' },
    { id: 'features', content: features, maturity: 'vague' },
    { id: 'techStack', content: idea.platform, maturity: 'vague' },
  ]
  return {
    projectName: idea.title,
    summary: idea.pitch,
    sections: sections.filter((s) => s.content.trim() !== ''),
  }
}

/**
 * Startzustand eines Projekts aus der gewählten Idee (Einstieg „keine Idee“). Die Person hat die
 * Idee bewusst gewählt, deshalb gelten die Abschnitte als bestätigter KI-Inhalt (`aiAccepted`)
 * und müssen nicht einzeln übernommen werden. Eigener Inhalt bleibt wie immer unangetastet.
 */
export function applyChosenIdea(
  project: Project,
  idea: Idea,
  { useSuggestedName = true }: { useSuggestedName?: boolean } = {},
): Project {
  const { project: classified, updated } = applyClassification(
    project,
    ideaToClassification(idea),
    'noIdea',
    { useSuggestedName },
  )
  return updated.reduce((current, id) => acceptSuggestion(current, id), classified)
}

/**
 * Steckbrief aus einer Idee der Ideenfindung, damit sie wie eine Variante als Eintrag gespeichert
 * werden kann (ADR 0012). Monetarisierung und Risiken kennt die Idee nicht; sie bleiben leer.
 */
export function ideaToDraft(idea: Idea): VariantDraft {
  return {
    name: idea.title,
    profile: {
      pitch: idea.pitch,
      problem: idea.problem,
      audience: idea.audience,
      features: [...idea.features],
      platform: idea.platform,
      monetization: { model: '', priceRange: '', reason: '' },
      effort: idea.effort,
      risks: [],
    },
  }
}
