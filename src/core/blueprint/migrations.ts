import { ProjectFormatError } from './errors'
import { CURRENT_SCHEMA_VERSION, projectSchema, type Project } from './schema'

/** Hebt Rohdaten von Version `n` auf Version `n + 1`. Der Schlüssel ist die Ausgangsversion `n`. */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>
export type MigrationMap = Readonly<Record<number, Migration>>

/**
 * Alle Migrationen des Projektformats. Bei einer Schemaänderung:
 * 1. `CURRENT_SCHEMA_VERSION` erhöhen,
 * 2. hier einen Eintrag `[alteVersion]: (data) => ({ ...data, schemaVersion: alteVersion + 1, … })` ergänzen,
 * 3. einen Test mit echten Daten der alten Version schreiben.
 */
export const PROJECT_MIGRATIONS: MigrationMap = {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Wendet Migrationen Schritt für Schritt an, bis `targetVersion` erreicht ist. */
export function runMigrations(
  data: unknown,
  migrations: MigrationMap,
  targetVersion: number,
): Record<string, unknown> {
  if (
    !isRecord(data) ||
    typeof data.schemaVersion !== 'number' ||
    !Number.isInteger(data.schemaVersion)
  ) {
    throw new ProjectFormatError('invalidFormat', 'Projektdaten haben keine gültige schemaVersion')
  }
  if (data.schemaVersion > targetVersion) {
    throw new ProjectFormatError(
      'unsupportedVersion',
      `Projektversion ${data.schemaVersion} ist neuer als diese App (${targetVersion})`,
    )
  }

  let current = data
  while ((current.schemaVersion as number) < targetVersion) {
    const from = current.schemaVersion as number
    const migrate = migrations[from]
    if (!migrate) {
      throw new ProjectFormatError(
        'unsupportedVersion',
        `Keine Migration von Version ${from} vorhanden`,
      )
    }
    current = migrate(current)
    if (current.schemaVersion !== from + 1) {
      throw new Error(`Migration ${from} muss schemaVersion auf ${from + 1} setzen`)
    }
  }
  return current
}

/** Liest beliebige gespeicherte Projektdaten, migriert sie auf die aktuelle Version und validiert sie. */
export function migrateProject(data: unknown): Project {
  const migrated = runMigrations(data, PROJECT_MIGRATIONS, CURRENT_SCHEMA_VERSION)
  const result = projectSchema.safeParse(migrated)
  if (!result.success) {
    throw new ProjectFormatError('invalidFormat', 'Projektdaten sind ungültig', {
      cause: result.error,
    })
  }
  return result.data
}
