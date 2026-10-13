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
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
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

/**
 * v2 → v3: Entscheidungen wandern aus den Abschnitten in die projektweite Liste `decisions`
 * (mit Vor-/Nachteilen, Status und Zeitpunkten); neu ist die Liste `additions` (Vorschlagsmodus).
 * Aus `question` wird `title`; eine gewählte Option macht die Entscheidung zu „entschieden“.
 */
function migrateV2ToV3(data: Record<string, unknown>): Record<string, unknown> {
  const timestamp = typeof data.updatedAt === 'string' ? data.updatedAt : new Date(0).toISOString()
  const decisions: Record<string, unknown>[] = []
  let blueprint = data.blueprint

  if (isRecord(data.blueprint) && isRecord(data.blueprint.sections)) {
    const sections: Record<string, unknown> = {}
    for (const [key, section] of Object.entries(data.blueprint.sections)) {
      if (!isRecord(section)) {
        sections[key] = section
        continue
      }
      const { decisions: oldDecisions, ...rest } = section
      sections[key] = rest
      if (!Array.isArray(oldDecisions)) continue
      for (const old of oldDecisions) {
        if (!isRecord(old)) continue
        const options = Array.isArray(old.options) ? old.options.filter(isRecord) : []
        // Unbrauchbare Altdaten (weniger als zwei Optionen) entfallen, statt das Projekt zu sperren.
        if (options.length < 2) continue
        // Eine gewählte Option, die es nicht mehr gibt, macht die Entscheidung wieder offen.
        const chosen =
          typeof old.chosenOptionId === 'string' && options.some((o) => o.id === old.chosenOptionId)
            ? old.chosenOptionId
            : null
        decisions.push({
          id: old.id,
          sectionId: key,
          title: old.question,
          context: '',
          leverage: old.leverage,
          options: options.map((o) => ({
            id: o.id,
            label: o.label,
            pros: [],
            cons: [],
            consequence: typeof o.consequence === 'string' ? o.consequence : '',
          })),
          recommendedOptionId: null,
          chosenOptionId: chosen,
          rationale: typeof old.rationale === 'string' ? old.rationale : '',
          status: chosen ? 'decided' : 'open',
          createdAt: timestamp,
          decidedAt: chosen ? timestamp : null,
        })
      }
    }
    blueprint = { ...data.blueprint, sections }
  }

  return { ...data, schemaVersion: 3, blueprint, decisions, additions: [] }
}

/** v3 → v4: die Monetarisierungs-Sektion kommt hinzu; bestehende Projekte haben sie noch nicht begonnen. */
function migrateV3ToV4(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data, schemaVersion: 4, monetization: null }
}

/**
 * v4 → v5: Steckbrief und Bibliothek kommen hinzu. Bestehende Projekte haben keinen Steckbrief und
 * stehen unverändert als gespeichert in der Bibliothek.
 */
function migrateV4ToV5(data: Record<string, unknown>): Record<string, unknown> {
  return {
    ...data,
    schemaVersion: 5,
    profile: null,
    library: { status: 'saved', trashedAt: null },
  }
}
