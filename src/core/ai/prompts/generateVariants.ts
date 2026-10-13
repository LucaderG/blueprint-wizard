import { z } from 'zod'
import { PROFILE_EFFORTS } from '@/core/blueprint/schema'
import type { ChatMessage } from '../types'
import { LANGUAGE_NAME } from './analyzeBlueprint'

/**
 * Prompt „Varianten erzeugen“: macht aus einer Idee in einem Satz ein bis drei deutlich
 * unterschiedliche Steckbriefe. Die KI wählt die Unterschiede frei (ADR 0012).
 * Bei inhaltlichen Änderungen am Prompt `version` erhöhen und die Golden Files neu erzeugen.
 */
export const GENERATE_VARIANTS_PROMPT_ID = 'generate-variants'
export const GENERATE_VARIANTS_PROMPT_VERSION = 1

/** Wählbare Zahl an Varianten; Standard ist eine. */
export const MIN_VARIANTS = 1
export const MAX_VARIANTS = 3
export const DEFAULT_VARIANT_COUNT = 1

/** Grenzen für Steckbriefe der KI. Von Hand darf ein Steckbrief davon abweichen. */
export const MIN_PROFILE_FEATURES = 5
export const MAX_PROFILE_FEATURES = 8
export const MIN_PROFILE_RISKS = 2
export const MAX_PROFILE_RISKS = 3

export const variantCandidateSchema = z.object({
  title: z.string(),
  pitch: z.string(),
  problem: z.string(),
  audience: z.string(),
  features: z.array(z.string()),
  platform: z.string(),
  monetization: z.object({ model: z.string(), priceRange: z.string(), reason: z.string() }),
  effort: z.enum(PROFILE_EFFORTS),
  risks: z.array(z.string()),
})
export type VariantCandidate = z.infer<typeof variantCandidateSchema>

export const variantsResultSchema = z.object({ variants: z.array(variantCandidateSchema) })
export type VariantsResult = z.infer<typeof variantsResultSchema>

export interface GenerateVariantsInput {
  /** Die Idee der Person, meist ein Satz. */
  idea: string
  /** Gewünschte Zahl an Varianten (1 bis 3). */
  count: number
  language: 'de' | 'en'
}

function countText(count: number): string {
  return count === 1
    ? 'Erstelle genau einen Steckbrief für die überzeugendste Umsetzung dieser Idee.'
    : `Erstelle genau ${count} Steckbriefe. Jede Variante setzt die Idee auf eine deutlich andere Art um. Worin sie sich unterscheiden (z. B. Zielgruppe, Funktionsumfang, Plattform, Geschäftsmodell), entscheidest du; wähle die Unterschiede, die für diese Idee am meisten ausmachen.`
}

export function buildGenerateVariantsMessages({
  idea,
  count,
  language,
}: GenerateVariantsInput): ChatMessage[] {
  const system = `Du bist ein erfahrener Produktberater für Softwareprojekte. Du machst aus einer groben Idee einen knappen, ehrlichen Steckbrief, mit dem jemand entscheiden kann, ob und wie er das Projekt baut (Vibe-Coding mit KI-Unterstützung).

Felder jedes Steckbriefs:
- title: kurzer, griffiger Arbeitstitel (höchstens 5 Wörter).
- pitch: ein bis zwei Sätze, worum es geht.
- problem: welches konkrete Problem gelöst wird.
- audience: für wen, möglichst konkret.
- features: ${MIN_PROFILE_FEATURES} bis ${MAX_PROFILE_FEATURES} Kernfunktionen der ersten Version, je eine kurze Zeile.
- platform: Plattform und grobe Technik in einer Zeile.
- monetization.model: das passende Geschäftsmodell in wenigen Worten (oder "Keine Monetarisierung", wenn das besser passt).
- monetization.priceRange: Preisrahmen als Spanne in Euro. Das ist immer eine Annahme, keine Marktdaten; schreibe es so.
- monetization.reason: ein Satz, warum das Modell passt.
- effort: "small" (ein paar Abende), "medium" (einige Wochenenden) oder "large" (mehrere Wochen und mehr).
- risks: ${MIN_PROFILE_RISKS} bis ${MAX_PROFILE_RISKS} wichtigste Risiken, je eine kurze Zeile.

Regeln:
- Bleib nah an der Idee der Person. Ergänze, was für einen brauchbaren Steckbrief fehlt, aber erfinde keinen anderen Zweck.
- Mehrere Varianten müssen sich deutlich unterscheiden und dürfen keinen gleichen Titel haben.
- Schreibe alle Texte auf ${LANGUAGE_NAME[language]}. Antworte ausschließlich mit JSON nach dem vorgegebenen Schema.`

  const user = `# Idee der Person
"""
${idea.trim()}
"""

# Aufgabe
${countText(count)}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
