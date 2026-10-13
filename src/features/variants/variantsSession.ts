import { z } from 'zod'
import { MAX_VARIANTS, MIN_VARIANTS } from '@/core/ai/prompts'

/** Schlüssel im sessionStorage: Die Variantenseite übersteht Neuladen, aber nicht das Schließen. */
export const VARIANTS_STORAGE_KEY = 'blueprint-wizard:variants'

/**
 * Was die Variantenseite zeigt: die Idee (für „Neu erzeugen“), die gewählte Anzahl und die Einträge
 * der letzten Erzeugung. Die Steckbriefe selbst liegen als Einträge im Repository.
 */
export const variantsSessionSchema = z.object({
  idea: z.string(),
  count: z.number().int().min(MIN_VARIANTS).max(MAX_VARIANTS),
  ids: z.array(z.string().min(1)),
})
export type VariantsSession = z.infer<typeof variantsSessionSchema>

/** Liest den Stand; fehlt er oder ist er ungültig, gibt es `null`. */
export function readVariantsSession(): VariantsSession | null {
  try {
    const raw = sessionStorage.getItem(VARIANTS_STORAGE_KEY)
    if (!raw) return null
    const result = variantsSessionSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function writeVariantsSession(session: VariantsSession): void {
  try {
    sessionStorage.setItem(VARIANTS_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Ohne sessionStorage geht nur das Neuladen der Variantenseite verloren.
  }
}
