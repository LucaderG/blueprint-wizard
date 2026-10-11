import { slugify } from './slugify'

describe('slugify', () => {
  it.each([
    ['Mein Projekt', 'mein-projekt'],
    ['Größe & Übermaß', 'groesse-uebermass'],
    ['Café Crème', 'cafe-creme'],
    ['  --Hallo, Welt!--  ', 'hallo-welt'],
    ['ÄÖÜ', 'aeoeue'],
    ['!!!', ''],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })
})
