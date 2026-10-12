import { z } from 'zod'
import { monetizationModelKindSchema, MONETIZATION_CRITERIA } from '@/core/blueprint/schema'
import type { MonetizationCriterion, MonetizationModelKind, Project } from '@/core/blueprint/schema'
import type { ChatMessage } from '../types'
import { describeBlueprint, describeLog, LANGUAGE_NAME } from './analyzeBlueprint'
import { describeDecided } from './identifyDecisions'

/**
 * Prompt „Monetarisierungsmodelle vorschlagen“: stellt passende Modelle mit Bewertung vor.
 * Die Auswahl trifft der Nutzer; bereinigt wird in `core/engine/monetization.ts`.
 * Bei inhaltlichen Änderungen am Prompt `version` erhöhen und die Golden Files neu erzeugen.
 */
export const SUGGEST_MONETIZATION_MODELS_PROMPT_ID = 'suggest-monetization-models'
export const SUGGEST_MONETIZATION_MODELS_PROMPT_VERSION = 1

/** Höchstzahl an Modellen pro Vorschlag (mehr werden beim Übernehmen verworfen). */
export const MAX_MODEL_CANDIDATES = 6

/** Kurzbeschreibung jedes Modells für den Prompt (feste Liste, die KI erfindet keine eigenen). */
export const MODEL_KIND_GUIDE: Record<MonetizationModelKind, string> = {
  oneTime: 'Einmalkauf: einmal zahlen, dauerhaft nutzen.',
  subscription: 'Abo: monatlich oder jährlich zahlen.',
  freemium: 'Freemium: Basis kostenlos, Pro-Funktionen kostenpflichtig.',
  usageBased: 'Nutzungsbasiert: zahlen pro Verbrauch (Anfragen, Speicher, Credits).',
  ads: 'Werbung: kostenlos, finanziert über Anzeigen.',
  commission: 'Provision/Marktplatz: Anteil an Transaktionen zwischen Nutzern.',
  inAppPurchase: 'In-App-Käufe: Zusatzinhalte oder virtuelle Güter.',
  license: 'Lizenz/B2B: Firmenlizenzen, Plätze, Verträge mit Unternehmen.',
  openCore: 'Open Core/Spenden: Kern offen, Bezahlteile oder Sponsoring.',
  none: 'Nicht monetarisieren: Hobby-, Lern- oder Gemeinwohlprojekt ohne Einnahmen.',
}

/** Bedeutung der Kriterien; 5 ist immer günstig für das Projekt. */
export const CRITERION_GUIDE: Record<MonetizationCriterion, string> = {
  revenuePotential: 'Umsatzpotenzial (5 = hoch)',
  implementationEase:
    'Einfache Umsetzung, z. B. Zahlungsabwicklung und Nutzerkonten (5 = sehr einfach)',
  userAcceptance: 'Akzeptanz bei der Zielgruppe, niedrige Einstiegshürde (5 = hoch)',
  predictability: 'Planbarkeit der Einnahmen (5 = gut planbar)',
  audienceFit: 'Passung zur Zielgruppe und ihrer Zahlungsbereitschaft (5 = sehr gut)',
  techFit: 'Passung zum geplanten Tech-Stack, wenig Zusatztechnik (5 = sehr gut)',
}

export const modelScoresCandidateSchema = z.object(
  Object.fromEntries(MONETIZATION_CRITERIA.map((c) => [c, z.number()])) as Record<
    MonetizationCriterion,
    z.ZodNumber
  >,
)

export const modelCandidateSchema = z.object({
  kind: monetizationModelKindSchema,
  title: z.string(),
  summary: z.string(),
  fitReason: z.string(),
  concerns: z.array(z.string()),
  /** Bewertungen 1–5; Werte außerhalb werden beim Übernehmen begrenzt. */
  scores: modelScoresCandidateSchema,
  recommended: z.boolean(),
})
export type ModelCandidate = z.infer<typeof modelCandidateSchema>

export const monetizationModelsResultSchema = z.object({
  models: z.array(modelCandidateSchema),
})
export type MonetizationModelsResult = z.infer<typeof monetizationModelsResultSchema>

export interface SuggestMonetizationModelsInput {
  project: Pick<Project, 'name' | 'blueprint' | 'interview' | 'decisions'>
  language: 'de' | 'en'
}

const guideLines = (guide: Record<string, string>) =>
  Object.entries(guide)
    .map(([id, description]) => `- ${id}: ${description}`)
    .join('\n')

export function buildSuggestMonetizationModelsMessages({
  project,
  language,
}: SuggestMonetizationModelsInput): ChatMessage[] {
  const system = `Du bist ein erfahrener Produktstratege für Software. Du hilfst Menschen, für ein geplantes Projekt ein passendes Erlösmodell zu finden.

Aufgabe: Stelle die Monetarisierungsmodelle vor, die für dieses Projekt ernsthaft in Frage kommen, und bewerte sie einheitlich.

Erlaubte Modelle (kind):
${guideLines(MODEL_KIND_GUIDE)}

Kriterien (scores, jeweils ganze Zahl 1–5, 5 ist immer günstig für das Projekt):
${guideLines(CRITERION_GUIDE)}

Liefere 4–${MAX_MODEL_CANDIDATES} Modelle, jedes kind höchstens einmal. Pro Modell:
- kind: eines der erlaubten Modelle.
- title: kurzer Titel, auf dieses Projekt zugeschnitten (z. B. "Abo für Teams").
- summary: 1–2 Sätze, wie das Modell in diesem Projekt konkret aussähe.
- fitReason: ein Satz, warum es passt.
- concerns: 1–3 ehrliche Gegengründe oder Risiken.
- scores: Bewertung nach allen Kriterien.
- recommended: true für höchstens zwei Modelle, die am besten passen.

Regeln:
- Bewerte auf Grundlage des Blueprints (Zielgruppe, Kernfunktionen, Plattform, Tech-Stack). Erfinde keine Marktzahlen oder Studien.
- Nimm "none" auf, wenn das Projekt nach Hobby, Lernprojekt oder Gemeinwohl klingt.
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
