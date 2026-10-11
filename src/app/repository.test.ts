import { DexieProjectRepository } from '@/core/storage/dexieProjectRepository'
import { createDefaultRepository } from './repository'

describe('createDefaultRepository', () => {
  it('speichert in IndexedDB', () => {
    expect(createDefaultRepository()).toBeInstanceOf(DexieProjectRepository)
  })
})
