import { AiError, type AiErrorCode } from '@/core/ai'

export type AiErrorKey = `ai.errors.${AiErrorCode}`

/**
 * Ordnet KI-Fehler einer verständlichen Meldung (i18n-Key) zu. Unbekannte Fehler landen bei
 * `ai.errors.unknown`. Die Zuordnung ist generisch, damit sie auch in späteren Phasen gilt.
 */
export function aiErrorKey(error: unknown): AiErrorKey {
  if (error instanceof AiError) return `ai.errors.${error.code}`
  return 'ai.errors.unknown'
}
