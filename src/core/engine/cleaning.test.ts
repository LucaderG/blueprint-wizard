import { clampLeverage, cleanTextList, normalizeText } from './cleaning'

describe('normalizeText', () => {
  it.each([
    ['  Hallo  ', 'hallo'],
    ['Web\n  App\tneu', 'web app neu'],
    ['ÄÖÜ Straße', 'äöü straße'],
    ['', ''],
  ])('normalisiert %j zu %j', (input, expected) => {
    expect(normalizeText(input)).toBe(expected)
  })
})

describe('clampLeverage', () => {
  it.each([
    [0, 1],
    [1, 1],
    [2.4, 2],
    [2.5, 3],
    [5, 5],
    [9, 5],
    [-0.4, 1],
    [Number.NaN, 3],
    [Number.POSITIVE_INFINITY, 3],
    [Number.NEGATIVE_INFINITY, 3],
  ])('begrenzt %s auf %s', (value, expected) => {
    expect(clampLeverage(value)).toBe(expected)
  })
})

describe('cleanTextList', () => {
  it('trimmt, entfernt leere Einträge und gleiche Texte ohne Groß-/Kleinschreibung', () => {
    expect(cleanTextList(['  Web ', '', '   ', 'web', 'Nativ', 'NATIV ', 'Hybrid'])).toEqual([
      'Web',
      'Nativ',
      'Hybrid',
    ])
  })

  it('behält den ersten Eintrag einer Dublette', () => {
    expect(cleanTextList(['Schnell', 'schnell'])).toEqual(['Schnell'])
  })

  it('begrenzt die Anzahl nach dem Bereinigen', () => {
    expect(cleanTextList(['', 'a', 'a', 'b', 'c', 'd'], 2)).toEqual(['a', 'b'])
  })

  it('kennt keine Obergrenze ohne Angabe', () => {
    const many = Array.from({ length: 50 }, (_, i) => `Punkt ${i}`)

    expect(cleanTextList(many)).toHaveLength(50)
  })

  it('liefert für eine leere Liste eine leere Liste', () => {
    expect(cleanTextList([])).toEqual([])
  })
})
