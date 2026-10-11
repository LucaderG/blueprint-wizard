import { z } from 'zod'
import type { IdeationProfile } from '@/core/ideation/profile'
import type { Idea } from '@/core/ideation/session'
import { IDEA_EFFORTS } from '@/core/ideation/session'
import type { ChatMessage } from '../types'
import { LANGUAGE_NAME } from './analyzeBlueprint'

/**
 * Prompt „Ideen finden“ für Menschen ohne Idee: erzeugt, verfeinert oder kombiniert Projektideen
 * auf Grundlage des Fragebogens.
 * Bei inhaltlichen Änderungen am Prompt `version` erhöhen und die Golden Files neu erzeugen.
 */
export const GENERATE_IDEAS_PROMPT_ID = 'generate-ideas'
export const GENERATE_IDEAS_PROMPT_VERSION = 1

/** So viele Ideen erbittet eine neue Runde (Plan: 3–5). */
export const IDEAS_PER_ROUND = 4

export const ideaCandidateSchema = z.object({
  title: z.string(),
  pitch: z.string(),
  problem: z.string(),
  audience: z.string(),
  features: z.array(z.string()),
  platform: z.string(),
  effort: z.enum(IDEA_EFFORTS),
  novelty: z.number(),
  learningValue: z.number(),
  learningNote: z.string(),
})
export type IdeaCandidate = z.infer<typeof ideaCandidateSchema>

export const ideasResultSchema = z.object({ ideas: z.array(ideaCandidateSchema) })
export type IdeasResult = z.infer<typeof ideasResultSchema>

export type RefineDirection = 'simpler' | 'bolder' | 'custom'

/** Was die KI tun soll. */
export type IdeaRequest =
  /** Neue Ideen (erste Runde und „Neu würfeln“). */
  | { kind: 'generate' }
  /** Neue Ideen in der Art einer bestehenden. */
  | { kind: 'moreLike'; idea: Idea }
  /** Eine Idee abwandeln: einfacher, ehrgeiziger oder nach eigenem Wunsch. */
  | { kind: 'refine'; idea: Idea; direction: RefineDirection; note: string }
  /** Zwei Ideen zu einer verbinden. */
  | { kind: 'combine'; ideas: readonly [Idea, Idea] }

export interface GenerateIdeasInput {
  profile: IdeationProfile
  request: IdeaRequest
  /** Titel schon gezeigter Ideen, die nicht wiederkommen sollen. */
  avoidTitles: readonly string[]
  language: 'de' | 'en'
}

/** Wie viele Ideen eine Anfrage liefern soll. */
export function ideaCountFor(request: IdeaRequest): number {
  return request.kind === 'generate' || request.kind === 'moreLike' ? IDEAS_PER_ROUND : 1
}

const TIME_TEXT: Record<NonNullable<IdeationProfile['availableTime']>, string> = {
  fewHours: 'ein paar Stunden',
  fewEvenings: 'ein paar Abende',
  fewWeekends: 'ein paar Wochenenden',
  fewWeeks: 'einige Wochen',
  longTerm: 'langfristig, mehrere Monate',
}

const PLATFORM_TEXT: Record<IdeationProfile['platform'], string> = {
  any: 'egal, schlag etwas Passendes vor',
  web: 'Web-App im Browser',
  mobile: 'Smartphone-App',
  desktop: 'Desktop-Programm',
  cli: 'Kommandozeilen-Werkzeug',
}

const orNone = (text: string) => (text.trim() ? text.trim() : '(keine Angabe)')
const listOrNone = (items: readonly string[]) =>
  items.length > 0 ? items.join(', ') : '(keine Angabe)'

/** Der Fragebogen als lesbarer Text für die KI. */
export function describeProfile(profile: IdeationProfile): string {
  return [
    `- Interessen: ${listOrNone(profile.interests)}`,
    `- Frust im Alltag: ${orNone(profile.frustrations)}`,
    `- Fähigkeiten: ${listOrNone(profile.skills)}`,
    `- Lernziel: ${orNone(profile.learningGoal)}`,
    `- Verfügbare Zeit: ${profile.availableTime ? TIME_TEXT[profile.availableTime] : '(keine Angabe)'}`,
    `- Plattform: ${PLATFORM_TEXT[profile.platform]}`,
  ].join('\n')
}

/** Eine Idee als lesbarer Text für die KI. */
export function describeIdea(idea: Idea): string {
  const features =
    idea.features.length > 0 ? idea.features.map((f) => `  - ${f}`).join('\n') : '  (keine)'
  return `Titel: ${idea.title}
Kurzbeschreibung: ${idea.pitch}
Problem: ${orNone(idea.problem)}
Zielgruppe: ${orNone(idea.audience)}
Kernfunktionen:
${features}
Plattform: ${orNone(idea.platform)}
Aufwand: ${idea.effort}, Neuheit: ${idea.novelty}/5, Lernwert: ${idea.learningValue}/5`
}

const REFINE_TEXT: Record<Exclude<RefineDirection, 'custom'>, string> = {
  simpler:
    'Mach die Idee deutlich einfacher: weniger Funktionen, kleinerer Aufwand, schnell zu einem ersten Ergebnis.',
  bolder:
    'Mach die Idee ehrgeiziger und origineller: ein überraschender Dreh, mehr Neuheit, gern etwas mehr Aufwand.',
}

function describeTask(request: IdeaRequest): string {
  switch (request.kind) {
    case 'generate':
      return `Schlage ${IDEAS_PER_ROUND} unterschiedliche Projektideen vor, die zu dieser Person passen.`
    case 'moreLike':
      return `Schlage ${IDEAS_PER_ROUND} neue Projektideen vor, die dieser Idee ähneln (gleiche Richtung, gleicher Geist), aber jeweils einen eigenen Ansatz haben. Wiederhole die Idee nicht selbst.

# Vorbild
${describeIdea(request.idea)}`
    case 'refine': {
      const wish =
        request.direction === 'custom'
          ? `Wunsch der Person: ${orNone(request.note)}`
          : REFINE_TEXT[request.direction]
      return `Wandle diese Idee ab und gib genau eine überarbeitete Idee zurück. ${wish}

# Idee
${describeIdea(request.idea)}`
    }
    case 'combine':
      return `Verbinde diese beiden Ideen zu genau einer neuen Idee, die das Beste aus beiden vereint und trotzdem klein genug für eine erste Version bleibt.

# Idee A
${describeIdea(request.ideas[0])}

# Idee B
${describeIdea(request.ideas[1])}`
  }
}

export function buildGenerateIdeasMessages({
  profile,
  request,
  avoidTitles,
  language,
}: GenerateIdeasInput): ChatMessage[] {
  const system = `Du bist ein kreativer, bodenständiger Mentor für Softwareprojekte. Du hilfst Menschen, die noch keine Projektidee haben, eine zu finden, die sie wirklich bauen wollen.

Regeln für jede Idee:
- Sie passt zu Interessen, Frust im Alltag, Fähigkeiten und Lernziel der Person; nutze den Frust als stärkste Quelle für echte Probleme.
- Sie ist mit der verfügbaren Zeit als erste Version machbar (Vibe-Coding mit KI-Unterstützung). Ist keine Zeit angegeben, plane eine kleine erste Version.
- Sie läuft auf der gewünschten Plattform, falls eine angegeben ist.
- title: kurzer, griffiger Arbeitstitel (höchstens 5 Wörter).
- pitch: ein bis zwei Sätze, worum es geht.
- problem: welches konkrete Problem gelöst wird.
- audience: für wen (oft die Person selbst).
- features: 3 bis 5 Kernfunktionen der ersten Version, je eine kurze Zeile.
- platform: Plattform und grobe Technik in einer Zeile.
- effort: "small" (ein paar Abende), "medium" (einige Wochenenden) oder "large" (mehrere Wochen und mehr).
- novelty: 1 bis 5, wie neu oder ungewöhnlich die Idee ist.
- learningValue: 1 bis 5, wie viel die Person dabei lernt, gemessen an ihren Fähigkeiten und ihrem Lernziel.
- learningNote: ein Satz, was sie dabei konkret lernt.
- Mehrere Ideen sollen sich deutlich unterscheiden (Thema, Aufwand, Neuheit).
- Keine der bereits gezeigten Ideen wiederholen.

Schreibe alle Texte auf ${LANGUAGE_NAME[language]}. Antworte ausschließlich mit JSON nach dem vorgegebenen Schema.`

  const avoid = avoidTitles.length > 0 ? avoidTitles.map((t) => `- ${t}`).join('\n') : '(keine)'
  const user = `# Fragebogen
${describeProfile(profile)}

# Aufgabe
${describeTask(request)}

# Bereits gezeigte Ideen (nicht wiederholen)
${avoid}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
