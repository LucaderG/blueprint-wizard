import Dexie, { type Table } from 'dexie'

export const DEFAULT_DB_NAME = 'blueprint-wizard'

/**
 * Ein gespeicherter Projektdatensatz. Bewusst lose typisiert: Ältere App-Versionen können Daten
 * in einem früheren Schema hinterlassen haben. Gültig wird ein Datensatz erst durch `migrateProject`.
 */
export type StoredProject = Record<string, unknown> & { id: string }

/** IndexedDB-Datenbank der App. Der Name ist für Tests austauschbar. */
export class BlueprintDb extends Dexie {
  declare readonly projects: Table<StoredProject, string>

  constructor(name: string = DEFAULT_DB_NAME) {
    super(name)
    this.version(1).stores({ projects: 'id, updatedAt' })
  }
}
