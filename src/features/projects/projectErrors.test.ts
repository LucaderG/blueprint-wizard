import { ProjectFormatError } from '@/core/blueprint'
import { ProjectNotFoundError } from '@/core/storage'
import { projectErrorKey } from './projectErrors'

describe('projectErrorKey', () => {
  it.each(['invalidJson', 'invalidFormat', 'unsupportedVersion'] as const)(
    'liefert für Formatfehler %s eine eigene Meldung',
    (code) => {
      expect(projectErrorKey(new ProjectFormatError(code, 'x'))).toBe(
        `projects.errors.import.${code}`,
      )
    },
  )

  it('erkennt fehlende Projekte', () => {
    expect(projectErrorKey(new ProjectNotFoundError('42'))).toBe('projects.errors.notFound')
  })

  it('fällt sonst auf eine allgemeine Meldung zurück', () => {
    expect(projectErrorKey(new Error('x'))).toBe('projects.errors.generic')
    expect(projectErrorKey('kaputt')).toBe('projects.errors.generic')
  })
})
