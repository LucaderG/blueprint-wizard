import { ProjectFormatError } from './errors'
import { migrateProject, PROJECT_MIGRATIONS, runMigrations, type MigrationMap } from './migrations'
import { CURRENT_SCHEMA_VERSION } from './schema'
import { makeProject } from './testing'

function formatError(fn: () => unknown) {
  try {
    fn()
  } catch (error) {
    if (error instanceof ProjectFormatError) return error.code
    throw error
  }
  throw new Error('Kein Fehler geworfen')
}

describe('runMigrations', () => {
  const dummy: MigrationMap = {
    1: (data) => ({ ...data, schemaVersion: 2, renamed: data.name }),
    2: (data) => ({ ...data, schemaVersion: 3, tags: [] }),
  }

  it('wendet alle Schritte nacheinander an', () => {
    expect(runMigrations({ schemaVersion: 1, name: 'A' }, dummy, 3)).toEqual({
      schemaVersion: 3,
      name: 'A',
      renamed: 'A',
      tags: [],
    })
  })

  it('lässt aktuelle Daten unverändert', () => {
    const data = { schemaVersion: 3, name: 'A' }

    expect(runMigrations(data, dummy, 3)).toBe(data)
  })

  it('lehnt neuere Versionen ab', () => {
    expect(formatError(() => runMigrations({ schemaVersion: 4 }, dummy, 3))).toBe(
      'unsupportedVersion',
    )
  })

  it('meldet eine fehlende Migration', () => {
    expect(formatError(() => runMigrations({ schemaVersion: 0 }, dummy, 3))).toBe(
      'unsupportedVersion',
    )
  })

  it.each([null, [], 'text', {}, { schemaVersion: '1' }, { schemaVersion: 1.5 }])(
    'lehnt Daten ohne gültige Version ab: %j',
    (data) => {
      expect(formatError(() => runMigrations(data, dummy, 3))).toBe('invalidFormat')
    },
  )

  it('erkennt eine fehlerhafte Migration', () => {
    const broken: MigrationMap = { 1: (data) => ({ ...data }) }

    expect(() => runMigrations({ schemaVersion: 1 }, broken, 2)).toThrow(
      'muss schemaVersion auf 2 setzen',
    )
  })
})

describe('migrateProject', () => {
  it('hat für jede ältere Version eine Migration', () => {
    for (let version = 1; version < CURRENT_SCHEMA_VERSION; version++) {
      expect(PROJECT_MIGRATIONS[version], `Migration ${version}`).toBeTypeOf('function')
    }
  })

  it('liefert ein gültiges Projekt zurück', () => {
    const project = makeProject()

    expect(migrateProject(JSON.parse(JSON.stringify(project)))).toEqual(project)
  })

  it('lehnt Daten ab, die nach der Migration ungültig sind', () => {
    expect(formatError(() => migrateProject({ ...makeProject(), name: '' }))).toBe('invalidFormat')
  })
})
