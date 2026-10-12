import { z } from 'zod'
import { pricingStrategyKindSchema } from '@/core/blueprint/schema'
import type { Monetization, PricingStrategyKind, Project } from '@/core/blueprint/schema'
import type { ChatMessage } from '../types'
import { describeBlueprint, LANGUAGE_NAME } from './analyzeBlueprint'
import { describeDecided } from './identifyDecisions'

/**
 * Prompt „Preisstrategien vorschlagen“: schlägt zu den gewählten Monetarisierungsmodellen passende
 * Preisstrategien mit Beispielpreisen vor. Preise sind Annahmen, keine Marktdaten.
 * Bei inhaltlichen Änderungen am Prompt `version` erhöhen und die Golden Files neu erzeugen.
 */
export const SUGGEST_PRICING_STRATEGIES_PROMPT_ID = 'suggest-pricing-strategies'
export const SUGGEST_PRICING_STRATEGIES_PROMPT_VERSION = 1

/** Höchstzahl an Preisstrategien pro Vorschlag (mehr werden beim Übernehmen verworfen). */
export const MAX_PRICING_CANDIDATES = 5

export const PRICING_STRATEGY_GUIDE: Record<PricingStrategyKind, string> = {
  tiers: 'Staffelpreise: mehrere Pakete, z. B. Basic, Pro, Team.',
  valueBased: 'Wertbasiert: Preis orientiert sich am Nutzen für die Kundschaft.',
  competitive: 'Wettbewerbsorientiert: Preis in Anlehnung an vergleichbare Angebote.',
  penetration: 'Penetrationspreis: niedriger Einstieg, um schnell Nutzer zu gewinnen.',
  skimming: 'Skimming: hoher Startpreis, der später sinkt.',
  perSeat: 'Pro Nutzer/Platz: Preis wächst mit der Teamgröße.',
  anchor: 'Ankerpreis: ein teures Paket lässt das mittlere günstig wirken.',
  trialDiscount: 'Testphase/Rabatte: kostenlos testen, Jahresrabatt, Frühbucherpreis.',
}

export const pricingCandidateSchema = z.object({
  strategy: pricingStrategyKindSchema,
  title: z.string(),
  summary: z.string(),
  examplePrices: z.string(),
  reason: z.string(),
  recommended: z.boolean(),
})
export type PricingCandidate = z.infer<typeof pricingCandidateSchema>

export const pricingStrategiesResultSchema = z.object({
  strategies: z.array(pricingCandidateSchema),
})
export type PricingStrategiesResult = z.infer<typeof pricingStrategiesResultSchema>

export interface SuggestPricingStrategiesInput {
  project: Pick<Project, 'name' | 'blueprint' | 'decisions'> & { monetization: Monetization }
  language: 'de' | 'en'
}

function describeChosenModels(monetization: Monetization): string {
  const lines = monetization.chosenModelIds.flatMap((id) => {
    const model = monetization.models.find((m) => m.id === id)
    if (!model) return []
    const title = model.title ? ` – ${model.title}` : ''
    return [`- ${model.kind}${title}: ${model.summary || '(ohne Beschreibung)'}`]
  })
  const rationale = monetization.modelRationale.trim()
  return [lines.join('\n') || '(keine)', rationale ? `Begründung: ${rationale}` : '']
    .filter(Boolean)
    .join('\n\n')
}

export function buildSuggestPricingStrategiesMessages({
  project,
  language,
}: SuggestPricingStrategiesInput): ChatMessage[] {
  const guide = Object.entries(PRICING_STRATEGY_GUIDE)
    .map(([id, description]) => `- ${id}: ${description}`)
    .join('\n')

  const system = `Du bist ein erfahrener Produktstratege für Software. Du hilfst Menschen, für ein gewähltes Erlösmodell eine passende Preisstrategie zu finden.

Aufgabe: Schlage Preisstrategien vor, die zu den gewählten Monetarisierungsmodellen und zum Projekt passen.

Erlaubte Strategien (strategy):
${guide}

Liefere 3–${MAX_PRICING_CANDIDATES} Strategien, jede strategy höchstens einmal. Pro Strategie:
- strategy: eine der erlaubten Strategien.
- title: kurzer Titel, auf dieses Projekt zugeschnitten.
- summary: 1–2 Sätze, wie die Strategie hier konkret umgesetzt würde.
- examplePrices: Beispielpreise als Spannen in Euro (z. B. "Pro: 4–8 € pro Monat"), passend zu Modell und Zielgruppe.
- reason: ein Satz, warum die Strategie passt, und ein Haken.
- recommended: true für höchstens eine Strategie, die am besten passt.

Regeln:
- Beispielpreise sind Annahmen zur Orientierung. Nenne immer Spannen, nie einen exakten Preis, und erfinde keine Marktzahlen, Studien oder Preise konkreter Wettbewerber.
- Die Strategien müssen zu den gewählten Modellen passen (z. B. keine Pakete für reine Werbefinanzierung).
- Kurz und ohne Fachjargon formulieren.

Schreibe alle Texte auf ${LANGUAGE_NAME[language]}. Antworte ausschließlich mit JSON nach dem vorgegebenen Schema.`

  const user = `Projekt: ${project.name}

# Gewählte Monetarisierung
${describeChosenModels(project.monetization)}

# Blueprint
${describeBlueprint(project)}

# Getroffene oder verworfene Entscheidungen
${describeDecided(project.decisions)}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
