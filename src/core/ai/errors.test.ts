import { AiError, aiErrorCodeForStatus, type AiErrorCode } from './errors'

describe('aiErrorCodeForStatus', () => {
  it.each([
    [400, 'badRequest'],
    [413, 'badRequest'],
    [422, 'badRequest'],
    [401, 'invalidKey'],
    [402, 'insufficientCredits'],
    [403, 'forbidden'],
    [404, 'modelUnavailable'],
    [408, 'timeout'],
    [429, 'rateLimited'],
    [502, 'modelUnavailable'],
    [503, 'modelUnavailable'],
    [504, 'timeout'],
    [500, 'unknown'],
    [418, 'unknown'],
    [200, 'unknown'],
  ] as const)('ordnet Status %i dem Code %s zu', (status, code) => {
    expect(aiErrorCodeForStatus(status)).toBe(code)
  })
})

describe('AiError', () => {
  it('ist ein Error mit Code, Meldung und Namen', () => {
    const error = new AiError('timeout', 'Zu langsam')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('AiError')
    expect(error.code).toBe('timeout')
    expect(error.message).toBe('Zu langsam')
    expect(error.status).toBeUndefined()
    expect(error.retryAfterSeconds).toBeUndefined()
    expect(error.cause).toBeUndefined()
  })

  it('übernimmt Status, Retry-After und Ursache', () => {
    const cause = new Error('ursprünglich')
    const error = new AiError('rateLimited', 'Limit', {
      status: 429,
      retryAfterSeconds: 30,
      cause,
    })

    expect(error.status).toBe(429)
    expect(error.retryAfterSeconds).toBe(30)
    expect(error.cause).toBe(cause)
  })

  it.each<[AiErrorCode, boolean]>([
    ['rateLimited', true],
    ['timeout', true],
    ['network', true],
    ['modelUnavailable', true],
    ['missingKey', false],
    ['invalidKey', false],
    ['insufficientCredits', false],
    ['forbidden', false],
    ['badRequest', false],
    ['invalidResponse', false],
    ['aborted', false],
    ['unknown', false],
  ])('ist für Code %s retryable=%s', (code, retryable) => {
    expect(new AiError(code, 'x').retryable).toBe(retryable)
  })
})
