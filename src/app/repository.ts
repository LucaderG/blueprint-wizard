import type { ProjectRepository } from '@/core/storage'
import { DexieProjectRepository } from '@/core/storage/dexieProjectRepository'

/** Das Repository der laufenden App: Projekte liegen in IndexedDB im Browser. */
export function createDefaultRepository(): ProjectRepository {
  return new DexieProjectRepository()
}
