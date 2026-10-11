export type ProjectFormatErrorCode = 'invalidJson' | 'invalidFormat' | 'unsupportedVersion'

/** Wird geworfen, wenn gespeicherte oder importierte Projektdaten nicht gelesen werden können. */
export class ProjectFormatError extends Error {
  readonly code: ProjectFormatErrorCode

  constructor(code: ProjectFormatErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ProjectFormatError'
    this.code = code
  }
}
