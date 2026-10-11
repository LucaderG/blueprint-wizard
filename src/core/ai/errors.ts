export type AiErrorCode =
  | 'missingKey'
  | 'invalidKey'
  | 'insufficientCredits'
  | 'forbidden'
  | 'rateLimited'
  | 'timeout'
  | 'network'
  | 'modelUnavailable'
  | 'badRequest'
  | 'invalidResponse'
  | 'aborted'
  | 'unknown'

/** Einheitlicher Fehler aller KI-Aufrufe. Die UI übersetzt `code` in eine verständliche Meldung. */
export class AiError extends Error {
  readonly code: AiErrorCode
  readonly status?: number
  /** Sekunden bis zum nächsten sinnvollen Versuch (aus `Retry-After`). */
  readonly retryAfterSeconds?: number

  constructor(
    code: AiErrorCode,
    message: string,
    options: { status?: number; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'AiError'
    this.code = code
    this.status = options.status
    this.retryAfterSeconds = options.retryAfterSeconds
  }

  /** Ob ein erneuter Versuch ohne Änderung durch den Nutzer Erfolg haben kann. */
  get retryable(): boolean {
    return ['rateLimited', 'timeout', 'network', 'modelUnavailable'].includes(this.code)
  }
}

export function aiErrorCodeForStatus(status: number): AiErrorCode {
  switch (status) {
    case 400:
    case 413:
    case 422:
      return 'badRequest'
    case 401:
      return 'invalidKey'
    case 402:
      return 'insufficientCredits'
    case 403:
      return 'forbidden'
    case 404:
    case 502:
    case 503:
      return 'modelUnavailable'
    case 408:
    case 504:
      return 'timeout'
    case 429:
      return 'rateLimited'
    default:
      return 'unknown'
  }
}
