import { describe, expect, it } from 'vitest'
import { entryPointFromSlug, entryPointPath, ENTRY_POINT_SLUGS } from './entryPoints'

describe('Einstiegspunkte und URL-Slugs', () => {
  it('ordnet die Slugs den Einstiegspunkten zu', () => {
    expect(ENTRY_POINT_SLUGS).toEqual({
      noIdea: 'keine-idee',
      partialIdea: 'teil-idee',
      almostDone: 'fast-fertig',
    })
    expect(entryPointFromSlug('keine-idee')).toBe('noIdea')
    expect(entryPointFromSlug('teil-idee')).toBe('partialIdea')
    expect(entryPointFromSlug('fast-fertig')).toBe('almostDone')
  })

  it('liefert für unbekannte Slugs null', () => {
    expect(entryPointFromSlug('')).toBeNull()
    expect(entryPointFromSlug('partialIdea')).toBeNull()
    expect(entryPointFromSlug('Teil-Idee')).toBeNull()
  })

  it('baut den Pfad zum Einstieg', () => {
    expect(entryPointPath('almostDone')).toBe('/neu/fast-fertig')
  })
})
