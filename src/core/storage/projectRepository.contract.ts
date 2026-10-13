import { beforeEach, describe, expect, it } from 'vitest'
import {
  computeCompleteness,
  createEmptyBlueprint,
  createEmptyInterview,
  CURRENT_SCHEMA_VERSION,
  EXPORT_FORMAT,
  PROJECT_NAME_MAX_LENGTH,
  ProjectFormatError,
  type ProjectFormatErrorCode,
} from '@/core/blueprint'
import { DUPLICATE_SUFFIX } from './projectOperations'
import {
  ProjectNotFoundError,
  type ProjectRepository,
  type RepositoryDeps,
} from './projectRepository'

const START = Date.parse('2026-01-01T00:00:00.000Z')

/** Deterministische Uhr: Jeder Aufruf liefert eine Sekunde später als der vorige. */
export function createTestClock(start = START): () => Date {
  let tick = 0
  return () => new Date(start + 1000 * tick++)
}

/** Fortlaufende IDs: `id-1`, `id-2`, … */
export function createTestIds(prefix = 'id-'): () => string {
  let next = 0
  return () => `${prefix}${++next}`
}

/** Zeitpunkt des `n`-ten Uhraufrufs (0-basiert) als ISO-Text. */
function at(n: number): string {
  return new Date(START + 1000 * n).toISOString()
}

async function expectFormatError(promise: Promise<unknown>, code: ProjectFormatErrorCode) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(ProjectFormatError)
  expect((error as ProjectFormatError).code).toBe(code)
}

/**
 * Vertrags-Testsuite, die jede `ProjectRepository`-Implementierung bestehen muss.
 * `createRepo` bekommt eine deterministische Uhr und fortlaufende IDs und liefert ein leeres Repository.
 */
export function describeProjectRepositoryContract(
  name: string,
  createRepo: (deps: Required<RepositoryDeps>) => ProjectRepository | Promise<ProjectRepository>,
): void {
  describe(`${name} (ProjectRepository-Vertrag)`, () => {
    let repo: ProjectRepository

    beforeEach(async () => {
      repo = await createRepo({ now: createTestClock(), newId: createTestIds() })
    })

    describe('create', () => {
      it('legt ein leeres Projekt mit getrimmtem Namen und Zeitstempeln der Uhr an', async () => {
        const project = await repo.create('  Mein Projekt  ')

        expect(project).toEqual({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          id: 'id-1',
          name: 'Mein Projekt',
          entryPoint: null,
          createdAt: at(0),
          updatedAt: at(0),
          blueprint: createEmptyBlueprint(),
          interview: createEmptyInterview(),
          decisions: [],
          additions: [],
          monetization: null,
          profile: null,
          library: { status: 'saved', trashedAt: null },
        })
        expect(await repo.get('id-1')).toEqual(project)
      })

      it('vergibt für jedes Projekt eine neue ID', async () => {
        const a = await repo.create('A')
        const b = await repo.create('B')
        expect(a.id).not.toBe(b.id)
      })

      it('akzeptiert Namen mit maximaler Länge', async () => {
        const name = 'x'.repeat(PROJECT_NAME_MAX_LENGTH)
        expect((await repo.create(name)).name).toBe(name)
      })

      it.each([
        ['leer', ''],
        ['nur Leerzeichen', '   '],
        ['zu lang', 'x'.repeat(PROJECT_NAME_MAX_LENGTH + 1)],
      ])('lehnt ungültige Namen ab (%s) und speichert nichts', async (_label, invalid) => {
        await expect(repo.create(invalid)).rejects.toThrow()
        expect(await repo.list()).toEqual([])
      })
    })

    describe('get', () => {
      it('liefert undefined für unbekannte IDs', async () => {
        expect(await repo.get('gibt-es-nicht')).toBeUndefined()
      })
    })

    describe('list', () => {
      it('ist anfangs leer', async () => {
        expect(await repo.list()).toEqual([])
      })

      it('sortiert nach letzter Änderung absteigend und liefert die Vollständigkeit', async () => {
        const a = await repo.create('A')
        await repo.create('B')
        await repo.create('C')
        a.blueprint.sections.problem.content = 'Ein echtes Problem'
        a.blueprint.sections.problem.maturity = 'decided'
        const savedA = await repo.save(a)

        const list = await repo.list()

        expect(list.map((s) => s.name)).toEqual(['A', 'C', 'B'])
        expect(list[0]).toEqual({
          id: savedA.id,
          name: 'A',
          updatedAt: savedA.updatedAt,
          completeness: computeCompleteness(savedA.blueprint).total,
          library: { status: 'saved', trashedAt: null },
          hasProfile: false,
        })
        expect(list[0]?.completeness).toBeGreaterThan(0)
        expect(list[1]?.completeness).toBe(0)
      })
    })

    describe('save', () => {
      it('speichert Änderungen am Blueprint und setzt updatedAt neu', async () => {
        const project = await repo.create('Projekt')
        project.blueprint.sections.audience.content = 'Kleine Teams'
        project.blueprint.sections.audience.maturity = 'vague'
        project.entryPoint = 'partialIdea'

        const saved = await repo.save(project)

        expect(saved.updatedAt).toBe(at(1))
        expect(saved.createdAt).toBe(at(0))
        expect(await repo.get(project.id)).toEqual(saved)
        expect(saved.blueprint.sections.audience).toMatchObject({
          content: 'Kleine Teams',
          maturity: 'vague',
        })
        expect(saved.entryPoint).toBe('partialIdea')
      })

      it('speichert und lädt eine begonnene Monetarisierung', async () => {
        const project = await repo.create('Projekt')
        project.monetization = {
          models: [
            {
              id: 'm1',
              kind: 'subscription',
              title: 'Team-Abo',
              summary: 'Monatlich pro Team.',
              fitReason: 'Laufender Nutzen.',
              concerns: ['Abo-Müdigkeit'],
              scores: {
                revenuePotential: 4,
                implementationEase: 3,
                userAcceptance: 3,
                predictability: 5,
                audienceFit: 4,
                techFit: 3,
              },
              recommended: true,
            },
          ],
          chosenModelIds: ['m1'],
          modelRationale: 'Passt zum Teamnutzen.',
          pricingOptions: [
            {
              id: 'p1',
              strategy: 'tiers',
              title: 'Free, Pro, Team',
              summary: 'Drei Pakete.',
              examplePrices: 'Pro: 4–8 € pro Monat',
              reason: 'Leicht verständlich.',
              recommended: true,
            },
          ],
          chosenPricingIds: ['p1'],
          pricingRationale: '',
          status: 'decided',
          decidedAt: at(1),
        }

        const saved = await repo.save(project)

        expect(await repo.get(project.id)).toEqual(saved)
        expect(saved.monetization).toEqual(project.monetization)
      })

      it('wirft ProjectNotFoundError für unbekannte IDs', async () => {
        const project = await repo.create('Projekt')
        await expect(repo.save({ ...project, id: 'unbekannt' })).rejects.toThrow(
          ProjectNotFoundError,
        )
        expect(await repo.get('unbekannt')).toBeUndefined()
      })

      it('lehnt ungültige Projekte ab und lässt den Speicher unverändert', async () => {
        const project = await repo.create('Projekt')
        await expect(repo.save({ ...project, name: '' })).rejects.toThrow()
        expect(await repo.get(project.id)).toEqual(project)
      })
    })

    describe('rename', () => {
      it('benennt um, trimmt den Namen und setzt updatedAt neu', async () => {
        const project = await repo.create('Alt')

        const renamed = await repo.rename(project.id, '  Neu ')

        expect(renamed).toEqual({ ...project, name: 'Neu', updatedAt: at(1) })
        expect(await repo.get(project.id)).toEqual(renamed)
      })

      it('lehnt ungültige Namen ab und lässt das Projekt unverändert', async () => {
        const project = await repo.create('Alt')
        await expect(repo.rename(project.id, '  ')).rejects.toThrow()
        expect(await repo.get(project.id)).toEqual(project)
      })

      it('wirft ProjectNotFoundError für unbekannte IDs', async () => {
        await expect(repo.rename('unbekannt', 'Neu')).rejects.toThrow(ProjectNotFoundError)
      })
    })

    describe('Papierkorb', () => {
      const DAY = 24 * 60 * 60 * 1000
      const afterDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY)

      it('trash legt das Projekt mit Zeitpunkt in den Papierkorb, ohne den Inhalt zu ändern', async () => {
        const project = await repo.create('Weg')

        const trashed = await repo.trash(project.id)

        expect(trashed).toEqual({ ...project, library: { status: 'trashed', trashedAt: at(1) } })
        expect(await repo.get(project.id)).toEqual(trashed)
      })

      it('trash behält den ersten Zeitpunkt, wenn das Projekt schon im Papierkorb liegt', async () => {
        const project = await repo.create('Weg')
        await repo.trash(project.id)

        expect((await repo.trash(project.id)).library.trashedAt).toBe(at(1))
      })

      it('restore stellt ein gelöschtes Projekt vollständig wieder her', async () => {
        const project = await repo.create('Zurück')
        project.blueprint.sections.problem.content = 'Wichtiger Inhalt'
        const saved = await repo.save(project)
        await repo.trash(saved.id)

        const restored = await repo.restore(saved.id)

        expect(restored).toEqual(saved)
        expect(await repo.get(saved.id)).toEqual(saved)
      })

      it('list filtert nach Status und liefert Bibliotheksstatus und Steckbrief-Kennung', async () => {
        const keep = await repo.create('Bleibt')
        const gone = await repo.create('Weg')
        await repo.trash(gone.id)

        expect((await repo.list({ status: 'saved' })).map((s) => s.id)).toEqual([keep.id])
        const trashList = await repo.list({ status: 'trashed' })
        expect(trashList.map((s) => s.id)).toEqual([gone.id])
        expect(trashList[0]).toMatchObject({
          library: { status: 'trashed', trashedAt: at(2) },
          hasProfile: false,
        })
        expect(await repo.list()).toHaveLength(2)
      })

      it('list kennzeichnet Einträge mit Steckbrief', async () => {
        const project = await repo.create('Steckbrief')
        await repo.save({
          ...project,
          profile: {
            pitch: 'Kurz gesagt.',
            problem: '',
            audience: '',
            features: [],
            platform: '',
            monetization: { model: '', priceRange: '', reason: '' },
            effort: 'small',
            risks: [],
          },
        })

        expect((await repo.list())[0]?.hasProfile).toBe(true)
      })

      it('save behält den gespeicherten Status, damit ein veralteter Stand nichts zurückholt', async () => {
        const project = await repo.create('Offen in einem anderen Tab')
        await repo.trash(project.id)

        const saved = await repo.save({ ...project, name: 'Geändert' })

        expect(saved.library).toEqual({ status: 'trashed', trashedAt: at(1) })
        expect((await repo.get(project.id))?.library.status).toBe('trashed')
      })

      it('deleteForever entfernt das Projekt endgültig', async () => {
        const keep = await repo.create('Bleibt')
        const gone = await repo.create('Weg')

        await repo.deleteForever(gone.id)

        expect(await repo.get(gone.id)).toBeUndefined()
        expect((await repo.list()).map((s) => s.id)).toEqual([keep.id])
      })

      it('purgeExpired löscht nur Einträge im Papierkorb, deren Frist abgelaufen ist', async () => {
        const saved = await repo.create('Gespeichert')
        const old = await repo.create('Alt')
        const fresh = await repo.create('Frisch')
        const oldTrashed = await repo.trash(old.id)
        await repo.trash(fresh.id)
        const now = afterDays(oldTrashed.library.trashedAt!, 1)

        const purged = await repo.purgeExpired(now, 1)

        expect(purged).toEqual([old.id])
        expect((await repo.list()).map((s) => s.id).sort()).toEqual([fresh.id, saved.id].sort())
      })

      it('purgeExpired trifft nie gespeicherte Einträge, auch bei sehr später Uhr', async () => {
        const saved = await repo.create('Gespeichert')

        expect(await repo.purgeExpired(new Date('2099-01-01T00:00:00.000Z'), 1)).toEqual([])
        expect(await repo.get(saved.id)).toEqual(saved)
      })

      it('purgeExpired richtet sich nach der Frist', async () => {
        const project = await repo.create('Sieben Tage')
        const trashed = await repo.trash(project.id)
        const twoDaysLater = afterDays(trashed.library.trashedAt!, 2)

        expect(await repo.purgeExpired(twoDaysLater, 7)).toEqual([])
        expect(await repo.purgeExpired(twoDaysLater, 1)).toEqual([project.id])
      })

      it.each(['trash', 'restore', 'deleteForever'] as const)(
        '%s wirft ProjectNotFoundError für unbekannte IDs',
        async (method) => {
          await expect(repo[method]('unbekannt')).rejects.toThrow(ProjectNotFoundError)
        },
      )
    })

    describe('duplicate', () => {
      it('legt eine Kopie mit neuer ID, Namenszusatz und neuen Zeitstempeln an', async () => {
        const original = await repo.create('Original')
        original.blueprint.sections.features.content = 'Login'
        const saved = await repo.save(original)

        const copy = await repo.duplicate(original.id)

        expect(copy).toEqual({
          ...saved,
          id: 'id-2',
          name: `Original${DUPLICATE_SUFFIX}`,
          createdAt: at(2),
          updatedAt: at(2),
        })
        expect(await repo.get(copy.id)).toEqual(copy)
        expect(await repo.list()).toHaveLength(2)
      })

      it('erzeugt eine unabhängige Kopie', async () => {
        const original = await repo.create('Original')
        const copy = await repo.duplicate(original.id)

        copy.blueprint.sections.problem.content = 'Nur in der Kopie'
        await repo.save(copy)

        expect((await repo.get(original.id))?.blueprint.sections.problem.content).toBe('')
      })

      it('legt die Kopie eines Eintrags im Papierkorb gespeichert an', async () => {
        const original = await repo.create('Original')
        await repo.trash(original.id)

        const copy = await repo.duplicate(original.id)

        expect(copy.library).toEqual({ status: 'saved', trashedAt: null })
      })

      it('kürzt den Namen auf die erlaubte Länge', async () => {
        const original = await repo.create('x'.repeat(PROJECT_NAME_MAX_LENGTH))
        const copy = await repo.duplicate(original.id)
        expect(copy.name).toHaveLength(PROJECT_NAME_MAX_LENGTH)
      })

      it('wirft ProjectNotFoundError für unbekannte IDs', async () => {
        await expect(repo.duplicate('unbekannt')).rejects.toThrow(ProjectNotFoundError)
      })
    })

    describe('Export und Import', () => {
      it('exportiert das Projekt im Austauschformat', async () => {
        const project = await repo.create('Export')

        const parsed: unknown = JSON.parse(await repo.exportProject(project.id))

        expect(parsed).toEqual({ format: EXPORT_FORMAT, exportedAt: at(1), project })
      })

      it('importiert einen Export als neues Projekt mit gleichem Inhalt', async () => {
        const original = await repo.create('Rundreise')
        original.blueprint.sections.risks.content = 'Zeitplan'
        original.blueprint.sections.risks.maturity = 'decided'
        const saved = await repo.save(original)
        const json = await repo.exportProject(saved.id)

        const imported = await repo.importProject(json)

        expect(imported.id).not.toBe(saved.id)
        expect(imported).toEqual({ ...saved, id: imported.id, updatedAt: imported.updatedAt })
        expect(imported.updatedAt > saved.updatedAt).toBe(true)
        expect(await repo.get(imported.id)).toEqual(imported)
        expect(await repo.get(saved.id)).toEqual(saved)
        expect(await repo.list()).toHaveLength(2)
      })

      it('importiert immer als gespeichert, auch einen Eintrag aus dem Papierkorb', async () => {
        const original = await repo.create('Aus dem Papierkorb')
        await repo.trash(original.id)
        const json = await repo.exportProject(original.id)

        const imported = await repo.importProject(json)

        expect(imported.library).toEqual({ status: 'saved', trashedAt: null })
      })

      it('lehnt Text ohne gültiges JSON ab', async () => {
        await expectFormatError(repo.importProject('{kein json'), 'invalidJson')
      })

      it('lehnt fremde JSON-Dateien ab', async () => {
        await expectFormatError(repo.importProject('{"foo": 1}'), 'invalidFormat')
        await expectFormatError(repo.importProject('[1, 2]'), 'invalidFormat')
      })

      it('lehnt Exporte mit ungültigem Projekt ab', async () => {
        const project = await repo.create('Kaputt')
        const json = JSON.stringify({
          format: EXPORT_FORMAT,
          exportedAt: at(5),
          project: { ...project, name: '' },
        })
        await expectFormatError(repo.importProject(json), 'invalidFormat')
      })

      it('lehnt Exporte aus einer neueren App-Version ab', async () => {
        const project = await repo.create('Zukunft')
        const json = JSON.stringify({
          format: EXPORT_FORMAT,
          exportedAt: at(5),
          project: { ...project, schemaVersion: CURRENT_SCHEMA_VERSION + 1 },
        })
        await expectFormatError(repo.importProject(json), 'unsupportedVersion')
        expect(await repo.list()).toHaveLength(1)
      })

      it('wirft ProjectNotFoundError beim Export unbekannter IDs', async () => {
        await expect(repo.exportProject('unbekannt')).rejects.toThrow(ProjectNotFoundError)
      })
    })

    describe('Kopien', () => {
      it('liefert Kopien: Änderungen an zurückgegebenen Objekten erreichen den Speicher nicht', async () => {
        const created = await repo.create('Original')
        created.name = 'verändert'
        created.blueprint.sections.problem.content = 'verändert'

        const fetched = await repo.get('id-1')
        if (!fetched) throw new Error('Projekt fehlt')
        expect(fetched.name).toBe('Original')
        expect(fetched.blueprint.sections.problem.content).toBe('')

        fetched.blueprint.sections.problem.content = 'wieder verändert'
        const saved = await repo.save({ ...fetched, name: 'Gespeichert' })
        saved.name = 'nach dem Speichern verändert'

        const again = await repo.get('id-1')
        expect(again?.name).toBe('Gespeichert')
        expect(again?.blueprint.sections.problem.content).toBe('wieder verändert')
      })
    })
  })
}
