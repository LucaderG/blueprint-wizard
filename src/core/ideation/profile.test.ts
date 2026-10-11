import {
  addTags,
  cleanTags,
  EMPTY_PROFILE,
  hasTag,
  isFieldAnswered,
  MAX_PROFILE_TEXT_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  normalizeProfile,
  parseTags,
  PROFILE_FIELDS,
  profileStatus,
  removeTag,
  toggleTag,
  type IdeationProfile,
} from './profile'

/** Ein Fragebogen mit allen Antworten gefüllt. */
const FULL_PROFILE: IdeationProfile = {
  interests: ['Musik', 'Kochen'],
  skills: ['TypeScript'],
  availableTime: 'fewEvenings',
  learningGoal: 'Audio-Programmierung lernen',
  frustrations: 'Playlists gehen verloren',
  platform: 'web',
}

describe('cleanTags', () => {
  it.each<[string, readonly string[], string[]]>([
    ['trimmt Leerraum am Rand', ['  Musik  '], ['Musik']],
    ['entfernt leere und nur leerzeichenhaltige Einträge', ['', '   ', 'Musik'], ['Musik']],
    ['entfernt Dubletten ohne Groß-/Kleinschreibung', ['Musik', 'musik', 'MUSIK'], ['Musik']],
    ['behält die Schreibweise des ersten Vorkommens', ['kochen', 'Kochen'], ['kochen']],
    ['fasst inneren Leerraum zusammen', ['Rock   und  Pop'], ['Rock und Pop']],
    [
      'erkennt Dubletten trotz unterschiedlichem Leerraum',
      ['Rock und Pop', 'rock  und   pop'],
      ['Rock und Pop'],
    ],
    ['lässt die Reihenfolge unverändert', ['C', 'A', 'B'], ['C', 'A', 'B']],
  ])('%s', (_name, input, expected) => {
    expect(cleanTags(input)).toEqual(expected)
  })

  it(`begrenzt auf MAX_TAGS (${MAX_TAGS}) Schlagwörter`, () => {
    const input = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `Tag ${i}`)
    const result = cleanTags(input)
    expect(result).toHaveLength(MAX_TAGS)
    expect(result[0]).toBe('Tag 0')
    expect(result[MAX_TAGS - 1]).toBe(`Tag ${MAX_TAGS - 1}`)
  })

  it('zählt Dubletten nicht gegen die Obergrenze', () => {
    const input = [
      'Eins',
      'eins',
      ' EINS ',
      ...Array.from({ length: MAX_TAGS - 1 }, (_, i) => `T${i}`),
    ]
    expect(cleanTags(input)).toHaveLength(MAX_TAGS)
  })

  it(`kürzt auf MAX_TAG_LENGTH (${MAX_TAG_LENGTH}) Zeichen`, () => {
    const result = cleanTags(['x'.repeat(MAX_TAG_LENGTH + 40)])
    expect(result).toEqual(['x'.repeat(MAX_TAG_LENGTH)])
  })

  it('trimmt nach dem Kürzen erneut, damit kein Leerzeichen am Ende bleibt', () => {
    const result = cleanTags(['a'.repeat(MAX_TAG_LENGTH - 1) + ' bbb'])
    expect(result).toEqual(['a'.repeat(MAX_TAG_LENGTH - 1)])
  })

  it('liefert für eine leere Liste eine leere Liste', () => {
    expect(cleanTags([])).toEqual([])
  })
})

describe('parseTags', () => {
  it.each<[string, string[]]>([
    ['Musik, Kochen', ['Musik', 'Kochen']],
    ['Musik; Kochen', ['Musik', 'Kochen']],
    ['Musik\nKochen', ['Musik', 'Kochen']],
    ['Musik, Kochen; Fotografie\nSport', ['Musik', 'Kochen', 'Fotografie', 'Sport']],
    ['  ,  ; ,\n', []],
    ['', []],
    ['Rock und Pop', ['Rock und Pop']],
  ])('zerlegt %j in %j', (input, expected) => {
    expect(parseTags(input)).toEqual(expected)
  })

  it('verwirft Dubletten über Trennzeichen hinweg', () => {
    expect(parseTags('Musik, musik; MUSIK')).toEqual(['Musik'])
  })
})

describe('addTags', () => {
  it('hängt neue Schlagwörter an und überspringt Dubletten', () => {
    expect(addTags(['Musik'], 'musik, Kochen')).toEqual(['Musik', 'Kochen'])
  })

  it('verändert die Eingabeliste nicht', () => {
    const tags = ['Musik']
    addTags(tags, 'Kochen')
    expect(tags).toEqual(['Musik'])
  })
})

describe('removeTag', () => {
  it('entfernt ein Schlagwort ohne Groß-/Kleinschreibung', () => {
    expect(removeTag(['Musik', 'Kochen'], 'MUSIK')).toEqual(['Kochen'])
  })

  it('lässt die Liste unverändert, wenn das Schlagwort fehlt', () => {
    expect(removeTag(['Musik'], 'Kochen')).toEqual(['Musik'])
  })

  it('verändert die Eingabeliste nicht', () => {
    const tags = ['Musik', 'Kochen']
    removeTag(tags, 'Musik')
    expect(tags).toEqual(['Musik', 'Kochen'])
  })
})

describe('toggleTag', () => {
  it('entfernt ein vorhandenes Schlagwort', () => {
    expect(toggleTag(['Musik', 'Kochen'], 'kochen')).toEqual(['Musik'])
  })

  it('fügt ein fehlendes Schlagwort hinzu', () => {
    expect(toggleTag(['Musik'], 'Kochen')).toEqual(['Musik', 'Kochen'])
  })

  it('ist zweimal angewendet wieder der Ausgangszustand', () => {
    const start = ['Musik']
    expect(toggleTag(toggleTag(start, 'Sport'), 'Sport')).toEqual(start)
  })
})

describe('hasTag', () => {
  it.each<[string[], string, boolean]>([
    [['Rock und Pop'], ' rock  und pop ', true],
    [['Musik'], 'MUSIK', true],
    [['Musik'], 'Kochen', false],
    [[], 'Musik', false],
  ])('hasTag(%j, %j) ist %s', (tags, tag, expected) => {
    expect(hasTag(tags, tag)).toBe(expected)
  })
})

describe('normalizeProfile', () => {
  it('bereinigt Schlagwörter und trimmt Freitexte', () => {
    const result = normalizeProfile({
      ...FULL_PROFILE,
      interests: [' Musik ', 'musik', ''],
      skills: ['  TypeScript  '],
      learningGoal: '  Audio lernen  ',
      frustrations: '\n Playlists \n',
    })
    expect(result.interests).toEqual(['Musik'])
    expect(result.skills).toEqual(['TypeScript'])
    expect(result.learningGoal).toBe('Audio lernen')
    expect(result.frustrations).toBe('Playlists')
  })

  it('übernimmt Zeit und Plattform unverändert', () => {
    const result = normalizeProfile({ ...FULL_PROFILE, availableTime: 'longTerm', platform: 'cli' })
    expect(result.availableTime).toBe('longTerm')
    expect(result.platform).toBe('cli')
  })

  it(`kürzt Freitexte auf MAX_PROFILE_TEXT_LENGTH (${MAX_PROFILE_TEXT_LENGTH}) Zeichen`, () => {
    const long = 'a'.repeat(MAX_PROFILE_TEXT_LENGTH + 500)
    const result = normalizeProfile({ ...EMPTY_PROFILE, learningGoal: long, frustrations: long })
    expect(result.learningGoal).toHaveLength(MAX_PROFILE_TEXT_LENGTH)
    expect(result.frustrations).toHaveLength(MAX_PROFILE_TEXT_LENGTH)
  })

  it('lässt einen bereits sauberen Fragebogen unverändert', () => {
    expect(normalizeProfile(FULL_PROFILE)).toEqual(FULL_PROFILE)
  })
})

describe('isFieldAnswered', () => {
  it.each<[(typeof PROFILE_FIELDS)[number], Partial<IdeationProfile>, boolean]>([
    ['interests', { interests: [] }, false],
    ['interests', { interests: ['  ', ''] }, false],
    ['interests', { interests: ['Musik'] }, true],
    ['skills', { skills: [] }, false],
    ['skills', { skills: [' '] }, false],
    ['skills', { skills: ['TypeScript'] }, true],
    ['learningGoal', { learningGoal: '   ' }, false],
    ['learningGoal', { learningGoal: 'Audio' }, true],
    ['frustrations', { frustrations: '' }, false],
    ['frustrations', { frustrations: ' \n ' }, false],
    ['frustrations', { frustrations: 'Listen' }, true],
    ['availableTime', { availableTime: null }, false],
    ['availableTime', { availableTime: 'fewHours' }, true],
    ['platform', { platform: 'any' }, true],
    ['platform', { platform: 'mobile' }, true],
  ])('%s mit %j ergibt %s', (field, overrides, expected) => {
    expect(isFieldAnswered({ ...EMPTY_PROFILE, ...overrides }, field)).toBe(expected)
  })
})

describe('profileStatus', () => {
  it('zählt im leeren Fragebogen nur die Plattform als beantwortet', () => {
    expect(profileStatus(EMPTY_PROFILE)).toEqual({
      answered: 1,
      total: PROFILE_FIELDS.length,
      canGenerate: false,
    })
  })

  it('zählt alle Fragen beim vollständigen Fragebogen', () => {
    expect(profileStatus(FULL_PROFILE)).toEqual({
      answered: PROFILE_FIELDS.length,
      total: PROFILE_FIELDS.length,
      canGenerate: true,
    })
  })

  it('erlaubt die Erzeugung mit Interessen allein', () => {
    expect(profileStatus({ ...EMPTY_PROFILE, interests: ['Musik'] }).canGenerate).toBe(true)
  })

  it('erlaubt die Erzeugung mit Frust im Alltag allein', () => {
    expect(profileStatus({ ...EMPTY_PROFILE, frustrations: 'Listen' }).canGenerate).toBe(true)
  })

  it('erlaubt die Erzeugung mit Lernziel allein', () => {
    expect(profileStatus({ ...EMPTY_PROFILE, learningGoal: 'Audio' }).canGenerate).toBe(true)
  })

  it('erlaubt die Erzeugung nicht mit Zeit und Plattform allein', () => {
    const status = profileStatus({ ...EMPTY_PROFILE, availableTime: 'fewWeeks', platform: 'web' })
    expect(status.answered).toBe(2)
    expect(status.canGenerate).toBe(false)
  })

  it('erlaubt die Erzeugung nicht mit Fähigkeiten allein', () => {
    expect(profileStatus({ ...EMPTY_PROFILE, skills: ['TypeScript'] }).canGenerate).toBe(false)
  })
})
