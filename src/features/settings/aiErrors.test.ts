import { AiError, type AiErrorCode } from '@/core/ai'
import i18n from '@/shared/i18n'
import { aiErrorKey, type AiErrorKey } from './aiErrors'

/** Vollständige Tabelle: der Typ erzwingt einen Eintrag für jeden Fehlercode. */
const KEYS: Record<AiErrorCode, AiErrorKey> = {
  missingKey: 'ai.errors.missingKey',
  invalidKey: 'ai.errors.invalidKey',
  insufficientCredits: 'ai.errors.insufficientCredits',
  forbidden: 'ai.errors.forbidden',
  rateLimited: 'ai.errors.rateLimited',
  timeout: 'ai.errors.timeout',
  network: 'ai.errors.network',
  modelUnavailable: 'ai.errors.modelUnavailable',
  badRequest: 'ai.errors.badRequest',
  invalidResponse: 'ai.errors.invalidResponse',
  aborted: 'ai.errors.aborted',
  unknown: 'ai.errors.unknown',
}

describe('aiErrorKey', () => {
  it.each(Object.keys(KEYS) as AiErrorCode[])('ordnet den Code %s seinem Schlüssel zu', (code) => {
    expect(aiErrorKey(new AiError(code, 'intern'))).toBe(KEYS[code])
  })

  it.each(Object.values(KEYS))('hat für %s eine deutsche Meldung', (key) => {
    const message = i18n.t(key)
    expect(message).not.toBe(key)
    expect(message.length).toBeGreaterThan(10)
  })

  it('zeigt bei ungültigem Key die festgelegte Meldung', () => {
    expect(i18n.t(aiErrorKey(new AiError('invalidKey', 'x')))).toBe(
      'Der API-Key ist ungültig oder wurde widerrufen.',
    )
  })

  it('fällt bei fremden Fehlern auf „unknown“ zurück', () => {
    expect(aiErrorKey(new Error('x'))).toBe('ai.errors.unknown')
    expect(aiErrorKey('kaputt')).toBe('ai.errors.unknown')
  })
})
