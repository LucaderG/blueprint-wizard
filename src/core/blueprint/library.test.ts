import {
  isTrashExpired,
  moveToTrash,
  restoreFromTrash,
  TRASH_RETENTION_DAYS,
  trashExpiresAt,
} from './library'
import { projectSchema } from './schema'
import { makeProject } from './testing'

const NOW = new Date('2026-10-12T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const trashed = (trashedAt: string) => ({ status: 'trashed' as const, trashedAt })

describe('TRASH_RETENTION_DAYS', () => {
  it('bietet 1, 7 und 30 Tage an', () => {
    expect(TRASH_RETENTION_DAYS).toEqual([1, 7, 30])
  })
})

describe('moveToTrash', () => {
  it('legt ein gespeichertes Projekt mit Zeitpunkt in den Papierkorb und lässt den Rest unverändert', () => {
    const project = makeProject()

    const result = moveToTrash(project, NOW)

    expect(result).toEqual({ ...project, library: trashed(NOW.toISOString()) })
    expect(projectSchema.safeParse(result).success).toBe(true)
  })

  it('behält den ersten Zeitpunkt, wenn das Projekt schon im Papierkorb liegt', () => {
    const project = makeProject({ library: trashed('2026-10-10T00:00:00.000Z') })

    expect(moveToTrash(project, NOW)).toBe(project)
  })
})

describe('restoreFromTrash', () => {
  it('stellt ein Projekt aus dem Papierkorb als gespeichert in die Bibliothek', () => {
    const project = makeProject({ library: trashed(NOW.toISOString()) })

    expect(restoreFromTrash(project)).toEqual({
      ...project,
      library: { status: 'saved', trashedAt: null },
    })
  })

  it('lässt gespeicherte Projekte unverändert', () => {
    const project = makeProject()

    expect(restoreFromTrash(project)).toBe(project)
  })
})

describe('trashExpiresAt', () => {
  it('liegt die eingestellte Zahl an Tagen nach dem Zeitpunkt im Papierkorb', () => {
    expect(trashExpiresAt(trashed('2026-10-12T12:00:00.000Z'), 1)).toEqual(
      new Date('2026-10-13T12:00:00.000Z'),
    )
    expect(trashExpiresAt(trashed('2026-10-12T12:00:00.000Z'), 30)).toEqual(
      new Date('2026-11-11T12:00:00.000Z'),
    )
  })

  it('ist null für gespeicherte Einträge', () => {
    expect(trashExpiresAt({ status: 'saved', trashedAt: null }, 1)).toBeNull()
  })
})

describe('isTrashExpired', () => {
  const since = (ms: number) => trashed(new Date(NOW.getTime() - ms).toISOString())

  it('ist abgelaufen, sobald die Frist erreicht ist', () => {
    expect(isTrashExpired(since(24 * HOUR), NOW, 1)).toBe(true)
    expect(isTrashExpired(since(25 * HOUR), NOW, 1)).toBe(true)
  })

  it('ist innerhalb der Frist nicht abgelaufen', () => {
    expect(isTrashExpired(since(24 * HOUR - 1), NOW, 1)).toBe(false)
    expect(isTrashExpired(since(6 * 24 * HOUR), NOW, 7)).toBe(false)
  })

  it('trifft nie gespeicherte Einträge', () => {
    expect(isTrashExpired({ status: 'saved', trashedAt: null }, NOW, 1)).toBe(false)
  })
})
