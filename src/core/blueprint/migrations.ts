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
export const PROJECT_MIGRATIONS: MigrationMap = {
  1: migrateV1ToV2,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * v1 → v2: Fragen wandern aus den Abschnitten in den projektweiten Fragenmotor (`interview`).
 * Alte Fragen bekommen ihren Abschnitt als `sectionId`, keine Optionen und keine Abhängigkeiten.
 * Eine alte Antwort wird zur Freitext-Antwort; „beantwortet“ ohne Antworttext wird wieder offen.
 */
function migrateV1ToV2(data: Record<string, unknown>): Record<string, unknown> {
  const timestamp = typeof data.updatedAt === 'string' ? data.updatedAt : new Date(0).toISOString()
  const questions: Record<string, unknown>[] = []
  let blueprint = data.blueprint

  if (isRecord(data.blueprint) && isRecord(data.blueprint.sections)) {
    const sections: Record<string, unknown> = {}
    for (const [key, section] of Object.entries(data.blueprint.sections)) {
      if (!isRecord(section)) {
        sections[key] = section
        continue
      }
      const { questions: oldQuestions, ...rest } = section
      sections[key] = rest
      if (!Array.isArray(oldQuestions)) continue
      for (const old of oldQuestions) {
        if (!isRecord(old)) continue
        const answerText = typeof old.answer === 'string' ? old.answer.trim() : ''
        const answered = old.status === 'answered' && answerText !== ''
        questions.push({
          id: old.id,
          sectionId: key,
          text: old.text,
          why: '',
          leverage: old.leverage,
          options: [],
          dependsOn: [],
          status: answered ? 'answered' : old.status === 'deferred' ? 'deferred' : 'open',
          answer: answered ? { kind: 'text', text: answerText } : null,
          createdAt: timestamp,
          answeredAt: answered ? timestamp : null,
        })
      }
    }
    blueprint = { ...data.blueprint, sections }
  }

  return {
    ...data,
    schemaVersion: 2,
    blueprint,
    interview: { questions, log: [], analysis: null },
  }
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
