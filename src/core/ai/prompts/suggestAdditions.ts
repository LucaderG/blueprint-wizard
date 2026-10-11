import { z } from 'zod'
import { additionSectionIdSchema } from '@/core/blueprint/schema'
import type { Addition, Project } from '@/core/blueprint/schema'
import type { ChatMessage } from '../types'
import { describeBlueprint, LANGUAGE_NAME } from './analyzeBlueprint'

/**
 * Prompt „Ergänzungen vorschlagen“ (Vorschlagsmodus): schlägt einzelne Kernfunktionen, Nicht-Ziele
 * und Risiken vor, die die Person einzeln annimmt oder ablehnt.
 * Bei inhaltlichen Änderungen am Prompt `version` erhöhen und die Golden Files neu erzeugen.
 */
export const SUGGEST_ADDITIONS_PROMPT_ID = 'suggest-additions'
export const SUGGEST_ADDITIONS_PROMPT_VERSION = 1

/** Höchstzahl an Vorschlägen pro Abschnitt. */
export const MAX_ADDITIONS_PER_SECTION = 4

export const additionCandidateSchema = z.object({
  sectionId: additionSectionIdSchema,
  text: z.string(),
  reason: z.string(),
})
export type AdditionCandidate = z.infer<typeof additionCandidateSchema>

export const additionsResultSchema = z.object({
  additions: z.array(additionCandidateSchema),
})
export type AdditionsResult = z.infer<typeof additionsResultSchema>

export interface SuggestAdditionsInput {
  project: Pick<Project, 'name' | 'blueprint' | 'additions'>
  language: 'de' | 'en'
}

function describeResolved(additions: readonly Addition[], status: Addition['status']): string {
  const lines = additions
    .filter((a) => a.status === status)
    .map((a) => `- [${a.sectionId}] ${a.text}`)
  return lines.length > 0 ? lines.join('\n') : '(keine)'
}

export function buildSuggestAdditionsMessages({
  project,
  language,
}: SuggestAdditionsInput): ChatMessage[] {
  const system = `Du bist ein erfahrener Produktberater. Du hilfst Menschen, ihren Blueprint für ein Softwareprojekt zu vervollständigen.

Aufgabe: Schlage sinnvolle Ergänzungen für drei Abschnitte vor:
- features: Kernfunktionen, die für die erste Version fehlen, obwohl das Ziel sie braucht.
- nonGoals: Dinge, die man bewusst NICHT baut, um den Umfang klein zu halten.
- risks: Risiken oder offene Punkte, die übersehen wurden (technisch, rechtlich, Nutzung).

Regeln:
- Höchstens ${MAX_ADDITIONS_PER_SECTION} Vorschläge pro Abschnitt; lieber wenige gute als viele.
- Jeder Vorschlag ist ein einzelner, konkreter Punkt (ein Satz oder eine Stichzeile), der für sich angenommen werden kann.
- reason: ein kurzer Satz, warum der Punkt zu diesem Projekt passt.
- Nichts vorschlagen, was schon im Blueprint steht, schon angenommen oder abgelehnt wurde.
- Kernfunktionen nur vorschlagen, wenn sie zum Ziel und zur Zielgruppe passen; der MVP soll klein bleiben.

Schreibe alle Texte auf ${LANGUAGE_NAME[language]}. Antworte ausschließlich mit JSON nach dem vorgegebenen Schema.`

  const user = `Projekt: ${project.name}

# Blueprint
${describeBlueprint(project)}

# Schon angenommene Vorschläge
${describeResolved(project.additions, 'accepted')}

# Abgelehnte Vorschläge (nicht erneut vorschlagen)
${describeResolved(project.additions, 'rejected')}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
