import type { TFunction } from 'i18next'
import { AiError } from '@/core/ai'

/**
 * Originalmeldung des Anbieters als Zusatzzeile unter der verständlichen Fehlermeldung.
 * Hilft bei der Fehlersuche, z. B. wenn OpenRouter ein Modell ablehnt. `null` für andere Fehler.
 */
export function aiErrorDetail(error: unknown, t: TFunction): string | null {
  if (!(error instanceof AiError) || !error.message) return null
  return error.status === undefined
    ? t('ai.errorDetails', { detail: error.message })
    : t('ai.errorDetailsWithStatus', { detail: error.message, status: error.status })
}
