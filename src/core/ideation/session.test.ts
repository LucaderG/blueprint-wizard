import { EMPTY_PROFILE } from './profile'
import {
  EMPTY_SESSION,
  ideaSchema,
  ideationSessionSchema,
  parseIdeationSession,
  type Idea,
  type IdeationSession,
} from './session'

/** Eine gültige Idee mit festen Werten. */
const IDEA: Idea = {
  id: 'idea-1',
  title: 'Playlist-Tagebuch',
  pitch: 'Notiert, welche Songs man wann gehört hat.',
  problem: 'Man vergisst, was man schon gehört hat.',
  audience: 'Musikliebhaber',
  features: ['Songs notieren', 'Monatsrückblick'],
  platform: 'Web-App',
  effort: 'small',
  novelty: 3,
  learningValue: 2,
  learningNote: 'Wie man Daten im Browser speichert.',
}

const SESSION: IdeationSession = {
  profile: { ...EMPTY_PROFILE, interests: ['Musik'], platform: 'web' },
  ideas: [IDEA],
  seenTitles: ['Playlist-Tagebuch'],
}

describe('ideaSchema', () => {
  it('akzeptiert eine gültige Idee', () => {
    expect(ideaSchema.safeParse(IDEA).success).toBe(true)
  })

  it.each<[string, Partial<Idea>]>([
    ['Neuheit 0', { novelty: 0 }],
    ['Neuheit 6', { novelty: 6 }],
    ['Neuheit mit Nachkommastelle', { novelty: 2.5 }],
    ['Lernwert 0', { learningValue: 0 }],
    ['Lernwert 6', { learningValue: 6 }],
    ['leerer Titel', { title: '' }],
    ['leere Kurzbeschreibung', { pitch: '' }],
    ['leere ID', { id: '' }],
    ['Aufwand außerhalb der Liste', { effort: 'huge' as Idea['effort'] }],
  ])('lehnt ab: %s', (_name, overrides) => {
    expect(ideaSchema.safeParse({ ...IDEA, ...overrides }).success).toBe(false)
  })
})

describe('ideationSessionSchema', () => {
  it('akzeptiert einen gültigen Stand', () => {
    expect(ideationSessionSchema.safeParse(SESSION).success).toBe(true)
  })

  it('akzeptiert einen leeren Stand', () => {
    expect(ideationSessionSchema.safeParse(EMPTY_SESSION).success).toBe(true)
  })

  it('lehnt eine Session mit ungültiger Idee ab', () => {
    const broken = { ...SESSION, ideas: [{ ...IDEA, novelty: 9 }] }
    expect(ideationSessionSchema.safeParse(broken).success).toBe(false)
  })

  it('lehnt einen fehlenden Fragebogen ab', () => {
    const { profile: _profile, ...withoutProfile } = SESSION
    expect(ideationSessionSchema.safeParse(withoutProfile).success).toBe(false)
  })
})

describe('parseIdeationSession', () => {
  it('liefert den leeren Stand bei null', () => {
    expect(parseIdeationSession(null)).toEqual(EMPTY_SESSION)
  })

  it('liefert den leeren Stand bei einer leeren Zeichenkette', () => {
    expect(parseIdeationSession('')).toEqual(EMPTY_SESSION)
  })

  it('liefert den leeren Stand bei kaputtem JSON', () => {
    expect(parseIdeationSession('{"profile": {')).toEqual(EMPTY_SESSION)
  })

  it('liefert den leeren Stand bei fremdem JSON', () => {
    expect(parseIdeationSession('{"foo": 1, "bar": [1, 2]}')).toEqual(EMPTY_SESSION)
  })

  it('liefert den leeren Stand bei JSON-null', () => {
    expect(parseIdeationSession('null')).toEqual(EMPTY_SESSION)
  })

  it('liefert den leeren Stand, wenn eine einzelne Idee ungültig ist', () => {
    const raw = JSON.stringify({ ...SESSION, ideas: [{ ...IDEA, effort: 'huge' }] })
    expect(parseIdeationSession(raw)).toEqual(EMPTY_SESSION)
  })

  it('liest einen gültigen Stand unverändert', () => {
    expect(parseIdeationSession(JSON.stringify(SESSION))).toEqual(SESSION)
  })
})
