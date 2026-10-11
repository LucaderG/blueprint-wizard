import { z } from 'zod'
import { maturitySchema, sectionIdSchema } from '@/core/blueprint/schema'
import type { Section } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import type { ChatMessage } from '../types'
import { SECTION_GUIDE } from './classifyIdea'

/**
 * Prompt „Antworten einarbeiten“: formuliert Abschnitte neu, sodass die Antworten einer
 * Fragerunde enthalten sind. Das Ergebnis ist ein Vorschlag, den die Person bestätigt.
 * Bei inhaltlichen Änderungen am Prompt `version` erhöhen und die Golden Files neu erzeugen.
 */
export const INTEGRATE_ANSWERS_PROMPT_ID = 'integrate-answers'
export const INTEGRATE_ANSWERS_PROMPT_VERSION = 1

export const integrationResultSchema = z.object({
  sections: z.array(
    z.object({
      id: sectionIdSchema,
      content: z.string(),
      maturity: maturitySchema,
    }),
  ),
})
export type IntegrationResult = z.infer<typeof integrationResultSchema>

export interface AnsweredQuestion {
  sectionId: SectionId
  question: string
  answer: string
}

export interface IntegrateAnswersInput {
  /** Aktueller Stand der betroffenen Abschnitte. */
  sections: readonly Pick<Section, 'id' | 'content' | 'maturity'>[]
  answers: readonly AnsweredQuestion[]
  language: 'de' | 'en'
}

const LANGUAGE_NAME = { de: 'Deutsch', en: 'Englisch' } as const

export function buildIntegrateAnswersMessages({
  sections,
  answers,
  language,
}: IntegrateAnswersInput): ChatMessage[] {
  const system = `Du hilfst Menschen, einen Blueprint für die Softwareentwicklung zu schreiben.

Aufgabe: Arbeite die Antworten der Person in die betroffenen Abschnitte ein.

Regeln:
- Behalte alle Informationen, die schon im Abschnitt stehen. Entferne nur, was einer Antwort direkt widerspricht.
- Übernimm die Antworten sinngemäß und konkret; erfinde nichts dazu.
- Schreibe knapp als Markdown (Stichpunkte erlaubt), im Stil des bestehenden Inhalts.
- maturity: "decided", wenn der Abschnitt danach klar festgelegt ist, sonst "vague".
- Gib nur Abschnitte zurück, die sich ändern, jeweils mit dem vollständigen neuen Inhalt.
- Schreibe auf ${LANGUAGE_NAME[language]}. Antworte ausschließlich mit JSON nach dem vorgegebenen Schema.`

  const sectionText = sections
    .map(
      (s) =>
        `## ${s.id} [${s.maturity}]\n(${SECTION_GUIDE[s.id]})\n${s.content.trim() || '(leer)'}`,
    )
    .join('\n\n')
  const answerText = answers
    .map((a) => `- [${a.sectionId}] Frage: ${a.question}\n  Antwort: ${a.answer}`)
    .join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: `# Abschnitte\n${sectionText}\n\n# Antworten\n${answerText}` },
  ]
}
