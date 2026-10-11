import { z } from 'zod'
import { maturitySchema, sectionIdSchema } from '@/core/blueprint/schema'
import type { EntryPoint } from '@/core/blueprint/schema'
import type { SectionId } from '@/core/blueprint/sections'
import type { ChatMessage } from '../types'

/**
 * Prompt „Idee einordnen“: verteilt einen Freitext auf die Blueprint-Abschnitte.
 * Bei inhaltlichen Änderungen am Prompt `version` erhöhen und die Tests anpassen.
 */
export const CLASSIFY_IDEA_PROMPT_ID = 'classify-idea'
export const CLASSIFY_IDEA_PROMPT_VERSION = 1

/** Worum es in jedem Abschnitt geht (Anleitung für die KI). */
export const SECTION_GUIDE: Record<SectionId, string> = {
  problem: 'Problem & Vision: Welches Problem wird gelöst, für wen, und wie sieht Erfolg aus?',
  audience:
    'Zielgruppe & Nutzer: Wer nutzt das Produkt, mit welchen Bedürfnissen und Vorkenntnissen?',
  features:
    'Kernfunktionen (MVP): Die wenigen Funktionen, ohne die die erste Version keinen Sinn ergibt.',
  nonGoals: 'Nicht-Ziele: Was bewusst nicht gebaut wird, zumindest nicht in der ersten Version.',
  flows:
    'Nutzerabläufe & Screens: Wichtigste Abläufe Schritt für Schritt und die Bildschirme dazu.',
  dataModel: 'Datenmodell: Welche Dinge (Entitäten) gespeichert werden und wie sie zusammenhängen.',
  techStack: 'Tech-Stack & Plattform: Web, Mobile, Desktop; Sprachen, Frameworks, Hosting.',
  integrations: 'Integrationen & externe Dienste: APIs, Login-Anbieter, Zahlungen, KI-Dienste usw.',
  risks: 'Risiken & offene Punkte: Unsicherheiten, technische Risiken, ungeklärte Fragen.',
  roadmap: 'Umsetzungs-Roadmap: Reihenfolge der Umsetzung in Phasen oder Meilensteinen.',
}

export const classifiedSectionSchema = z.object({
  id: sectionIdSchema,
  content: z.string(),
  maturity: maturitySchema,
})

export const classificationSchema = z
  .object({
    projectName: z.string().nullable(),
    summary: z.string(),
    sections: z.array(classifiedSectionSchema),
  })
  .refine((value) => new Set(value.sections.map((s) => s.id)).size === value.sections.length, {
    message: 'Jeder Abschnitt darf höchstens einmal vorkommen',
    path: ['sections'],
  })
export type Classification = z.infer<typeof classificationSchema>

export interface ClassifyIdeaInput {
  text: string
  entryPoint: EntryPoint
  language: 'de' | 'en'
}

const ENTRY_POINT_HINT: Record<EntryPoint, string> = {
  noIdea: 'Die Person hat noch keine konkrete Idee; der Text sind lose Gedanken oder Interessen.',
  partialIdea: 'Die Person hat eine Teil-Idee; viele Abschnitte werden leer oder vage sein.',
  almostDone: 'Die Person hat ein fast fertiges Konzept; ordne gründlich und vollständig zu.',
}

const LANGUAGE_NAME = { de: 'Deutsch', en: 'Englisch' } as const

export function buildClassifyIdeaMessages({
  text,
  entryPoint,
  language,
}: ClassifyIdeaInput): ChatMessage[] {
  const guide = Object.entries(SECTION_GUIDE)
    .map(([id, description]) => `- ${id}: ${description}`)
    .join('\n')

  const system = `Du hilfst Menschen, aus einer Projektidee einen klaren Blueprint für die Softwareentwicklung zu machen.

Aufgabe: Ordne den Text der Person den Blueprint-Abschnitten zu.

Abschnitte:
${guide}

Regeln:
- Übernimm nur, was im Text steht oder eindeutig daraus folgt. Erfinde nichts dazu; Vorschläge kommen später.
- Fasse pro Abschnitt knapp und konkret als Markdown zusammen (Stichpunkte erlaubt).
- Reifegrad pro Abschnitt: "empty" = nichts dazu im Text, "vague" = angedeutet oder unklar, "decided" = klar und konkret festgelegt.
- Abschnitte ohne Inhalt lässt du weg oder gibst sie mit "empty" und leerem content zurück.
- projectName: kurzer Arbeitstitel, falls der Text einen nahelegt, sonst null.
- summary: ein Satz, worum es in der Idee geht.
- Schreibe alle Inhalte auf ${LANGUAGE_NAME[language]}.
- Antworte ausschließlich mit JSON nach dem vorgegebenen Schema.

Kontext: ${ENTRY_POINT_HINT[entryPoint]}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: `Text der Person:\n"""\n${text.trim()}\n"""` },
  ]
}
