import { z } from 'zod'
import { sectionIdSchema } from '@/core/blueprint/schema'
import type { Decision, Project } from '@/core/blueprint/schema'
import type { ChatMessage } from '../types'
import { describeBlueprint, describeLog, LANGUAGE_NAME } from './analyzeBlueprint'
import { SECTION_GUIDE } from './classifyIdea'

/**
 * Prompt „Entscheidungen finden“: ermittelt die Kernentscheidungen mit Optionen, Vor- und Nachteilen.
 * Die Rangfolge bestimmt nicht die KI, sondern `core/engine/decisions.ts`.
 * Bei inhaltlichen Änderungen am Prompt `version` erhöhen und die Golden Files neu erzeugen.
 */
export const IDENTIFY_DECISIONS_PROMPT_ID = 'identify-decisions'
export const IDENTIFY_DECISIONS_PROMPT_VERSION = 1

/** Höchstzahl an Entscheidungen pro Ermittlung (mehr werden beim Übernehmen verworfen). */
export const MAX_DECISION_CANDIDATES = 7
/** Höchstzahl an Optionen pro Entscheidung. */
export const MAX_DECISION_OPTIONS = 4

export const decisionOptionCandidateSchema = z.object({
  label: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  consequence: z.string(),
})

export const decisionCandidateSchema = z.object({
  sectionId: sectionIdSchema,
  title: z.string(),
  context: z.string(),
  /** 1 = Detail, 5 = Grundsatz. Werte außerhalb werden beim Übernehmen begrenzt. */
  leverage: z.number(),
  options: z.array(decisionOptionCandidateSchema),
  /** Index der empfohlenen Option (0-basiert) oder null. */
  recommendedOption: z.number().nullable(),
})
export type DecisionCandidate = z.infer<typeof decisionCandidateSchema>

export const decisionsResultSchema = z.object({
  decisions: z.array(decisionCandidateSchema),
})
export type DecisionsResult = z.infer<typeof decisionsResultSchema>

export interface IdentifyDecisionsInput {
  project: Pick<Project, 'name' | 'blueprint' | 'interview' | 'decisions'>
  language: 'de' | 'en'
}

export function describeDecided(decisions: readonly Decision[]): string {
  const lines = decisions.flatMap((d) => {
    if (d.status === 'open') return []
    if (d.status === 'dismissed') return [`- [${d.sectionId}] ${d.title} → (verworfen)`]
    const chosen = d.options.find((o) => o.id === d.chosenOptionId)?.label ?? ''
    return [`- [${d.sectionId}] ${d.title} → ${chosen}`]
  })
  return lines.length > 0 ? lines.join('\n') : '(keine)'
}

export function buildIdentifyDecisionsMessages({
  project,
  language,
}: IdentifyDecisionsInput): ChatMessage[] {
  const guide = Object.entries(SECTION_GUIDE)
    .map(([id, description]) => `- ${id}: ${description}`)
    .join('\n')

  const system = `Du bist ein erfahrener Software-Architekt und Produktberater. Du hilfst Menschen, aus einer Projektidee einen klaren Blueprint zu machen.

Aufgabe: Finde die Entscheidungen, die für dieses Projekt den größten Unterschied machen und noch nicht getroffen sind.

Abschnitte:
${guide}

Liefere höchstens ${MAX_DECISION_CANDIDATES} Entscheidungen (3–${MAX_DECISION_CANDIDATES}, wenn der Blueprint genug hergibt). Pro Entscheidung:
- sectionId: der Abschnitt, den die Entscheidung vor allem prägt.
- title: die Entscheidung als kurze Frage (z. B. "Web-App oder native App?").
- context: 1–2 Sätze, warum sie ansteht und was davon abhängt.
- leverage (Hebel) 1–5: 5 = prägt Aufwand, Technik oder Umfang grundlegend (Plattform, Zielgruppe, MVP-Schnitt, Datenhaltung lokal oder Server); 3 = wichtige Weichenstellung; 1 = Detail.
- options: 2–${MAX_DECISION_OPTIONS} realistische, sich ausschließende Optionen, je mit label, 1–3 pros, 1–3 cons und consequence (ein Satz: was die Wahl für Aufwand, Technik oder Umfang bedeutet).
- recommendedOption: Index (ab 0) der Option, die für dieses Projekt am besten passt, oder null, wenn es ohne weitere Infos nicht sinnvoll ist.

Regeln:
- Nur echte Weichenstellungen, keine Geschmacksfragen und keine Fragen, die schon entschieden sind.
- Bereits getroffene oder verworfene Entscheidungen nicht noch einmal vorschlagen.
- Berücksichtige, was im Blueprint und in den bisherigen Antworten steht; Empfehlungen müssen dazu passen.
- Kurz und ohne Fachjargon formulieren.

Schreibe alle Texte auf ${LANGUAGE_NAME[language]}. Antworte ausschließlich mit JSON nach dem vorgegebenen Schema.`

  const user = `Projekt: ${project.name}

# Blueprint
${describeBlueprint(project)}

# Bisherige Antworten
${describeLog(project.interview.log)}

# Getroffene oder verworfene Entscheidungen
${describeDecided(project.decisions)}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
