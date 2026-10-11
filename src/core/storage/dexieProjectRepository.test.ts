import {
  createEmptyProject,
  CURRENT_SCHEMA_VERSION,
  migrateProject,
  ProjectFormatError,
  projectSchema,
  runMigrations,
  type MigrationMap,
  type ProjectFormatErrorCode,
} from '@/core/blueprint'
import type * as BlueprintModule from '@/core/blueprint'
import { BlueprintDb, DEFAULT_DB_NAME } from './db'
import { DexieProjectRepository } from './dexieProjectRepository'
import {
  createTestClock,
  createTestIds,
  describeProjectRepositoryContract,
} from './projectRepository.contract'
import { ProjectNotFoundError } from './projectRepository'

// `migrateProject` ruft standardmäßig die echte Implementierung auf; einzelne Tests ersetzen sie,
// um das Hochmigrieren älterer Datensätze zu simulieren (`PROJECT_MIGRATIONS` ist noch leer).
vi.mock('@/core/blueprint', async (importOriginal) => {
  const actual = await importOriginal<typeof BlueprintModule>()
  return { ...actual, migrateProject: vi.fn(actual.migrateProject) }
})

let dbCounter = 0
const openDbs: BlueprintDb[] = []

function freshDbName(): string {
  return `blueprint-wizard-test-${++dbCounter}`
}

function openDb(name: string): BlueprintDb {
  const db = new BlueprintDb(name)
  openDbs.push(db)
  return db
}

afterEach(async () => {
  vi.mocked(migrateProject).mockReset()
  await Promise.all(openDbs.splice(0).map((db) => db.delete()))
})

describeProjectRepositoryContract(
  'DexieProjectRepository',
  (deps) => new DexieProjectRepository({ ...deps, db: openDb(freshDbName()) }),
)

async function expectFormatError(promise: Promise<unknown>, code: ProjectFormatErrorCode) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(ProjectFormatError)
  expect((error as ProjectFormatError).code).toBe(code)
}

describe('DexieProjectRepository (IndexedDB-spezifisch)', () => {
  let db: BlueprintDb
  let repo: DexieProjectRepository

  beforeEach(() => {
    db = openDb(freshDbName())
    repo = new DexieProjectRepository({ db, now: createTestClock(), newId: createTestIds() })
  })

  function validRecord(id: string, name = 'Gespeichert') {
    return createEmptyProject({ id, name, now: new Date('2025-06-01T12:00:00.000Z') })
  }

  it('nutzt standardmäßig die Datenbank "blueprint-wizard"', () => {
    expect(new BlueprintDb().name).toBe(DEFAULT_DB_NAME)
    expect(DEFAULT_DB_NAME).toBe('blueprint-wizard')
  })

  it('funktioniert mit Standard-Abhängigkeiten', async () => {
    const project = await new DexieProjectRepository({ db }).create('Standard')
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(Date.parse(project.createdAt)).not.toBeNaN()
  })

  it('behält Daten über eine neue Repository-Instanz hinweg (Neuladen der Seite)', async () => {
    const created = await repo.create('Bleibt erhalten')
    db.close()

    const reopened = new DexieProjectRepository({ db: openDb(db.name) })

    expect(await reopened.get(created.id)).toEqual(created)
    expect((await reopened.list()).map((s) => s.id)).toEqual([created.id])
  })

  describe('beschädigte Datensätze', () => {
    beforeEach(async () => {
      await db.projects.put({ id: 'kaputt', schemaVersion: 1, name: '' })
    })

    it('überspringt sie in list(), warnt und behält sie in der Datenbank', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const ok = await repo.create('Intakt')

      const list = await repo.list()

      expect(list.map((s) => s.id)).toEqual([ok.id])
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0]?.[0]).toContain('kaputt')
      expect(await db.projects.get('kaputt')).toEqual({ id: 'kaputt', schemaVersion: 1, name: '' })
    })

    it('get() wirft ProjectFormatError', async () => {
      await expectFormatError(repo.get('kaputt'), 'invalidFormat')
    })

    it('rename(), duplicate() und Export werfen ProjectFormatError', async () => {
      await expectFormatError(repo.rename('kaputt', 'Neu'), 'invalidFormat')
      await expectFormatError(repo.duplicate('kaputt'), 'invalidFormat')
      await expectFormatError(repo.exportProject('kaputt'), 'invalidFormat')
      expect(await db.projects.count()).toBe(1)
    })

    it('lassen sich löschen', async () => {
      await repo.delete('kaputt')
      expect(await db.projects.get('kaputt')).toBeUndefined()
    })

    it('ohne schemaVersion gelten als ungültiges Format', async () => {
      await db.projects.put({ id: 'ohne-version', name: 'Alt' })
      await expectFormatError(repo.get('ohne-version'), 'invalidFormat')
    })
  })

  describe('Schemaversionen', () => {
    it('Version 0 ohne Migration wirft unsupportedVersion und bleibt unverändert', async () => {
      const record = { ...validRecord('alt'), schemaVersion: 0 }
      await db.projects.put(record)
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expectFormatError(repo.get('alt'), 'unsupportedVersion')
      expect(await repo.list()).toEqual([])
      expect(await db.projects.get('alt')).toEqual(record)
    })

    it('eine neuere Version als die App wirft unsupportedVersion', async () => {
      await db.projects.put({ ...validRecord('neu'), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })
      await expectFormatError(repo.get('neu'), 'unsupportedVersion')
    })

    describe('mit simulierter Migration', () => {
      // Fiktives Altformat (Version 0): Der Projektname hieß damals `title`.
      const legacyMigrations: MigrationMap = {
        0: ({ title, ...rest }) => ({ ...rest, name: title, schemaVersion: 1 }),
      }

      function legacyRecord(id: string) {
        const { name, ...rest } = validRecord(id, 'Altprojekt')
        return { ...rest, title: name, schemaVersion: 0 }
      }

      beforeEach(() => {
        vi.mocked(migrateProject).mockImplementation((data) =>
          projectSchema.parse(runMigrations(data, legacyMigrations, CURRENT_SCHEMA_VERSION)),
        )
      })

      it('get() liefert das migrierte Projekt und schreibt es zurück', async () => {
        await db.projects.put(legacyRecord('alt'))

        const project = await repo.get('alt')

        expect(project).toEqual(validRecord('alt', 'Altprojekt'))
        expect(await db.projects.get('alt')).toEqual(project)
      })

      it('list() migriert ebenfalls und schreibt zurück', async () => {
        await db.projects.put(legacyRecord('alt'))

        const list = await repo.list()

        expect(list).toEqual([
          expect.objectContaining({ id: 'alt', name: 'Altprojekt', completeness: 0 }),
        ])
        expect(await db.projects.get('alt')).toEqual(validRecord('alt', 'Altprojekt'))
      })

      it('aktuelle Datensätze werden nicht neu geschrieben', async () => {
        // Das Schema entfernt unbekannte Felder; bliebe `extra` erhalten, wurde nicht zurückgeschrieben.
        const current = validRecord('aktuell')
        await db.projects.put({ ...current, extra: 'bleibt' })

        expect(await repo.get('aktuell')).toEqual(current)
        await repo.list()
        expect(await db.projects.get('aktuell')).toEqual({ ...current, extra: 'bleibt' })
      })
    })
  })

  it('wirft ProjectNotFoundError, wenn ein Projekt zwischenzeitlich gelöscht wurde', async () => {
    const project = await repo.create('Weg')
    await db.projects.delete(project.id)
    await expect(repo.save(project)).rejects.toThrow(ProjectNotFoundError)
  })
})
