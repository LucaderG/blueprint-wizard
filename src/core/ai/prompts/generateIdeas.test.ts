import { EMPTY_PROFILE, type IdeationProfile } from '@/core/ideation/profile'
import type { Idea } from '@/core/ideation/session'
import type { ChatMessage } from '../types'
import {
  buildGenerateIdeasMessages,
  describeIdea,
  describeProfile,
  GENERATE_IDEAS_PROMPT_ID,
  GENERATE_IDEAS_PROMPT_VERSION,
  ideaCountFor,
  ideasResultSchema,
  IDEAS_PER_ROUND,
} from './generateIdeas'

// ---------------------------------------------------------------------------
// Feste Beispiele
// ---------------------------------------------------------------------------

/** Textform der Nachrichten, mit der die Golden Files verglichen werden. */
const asText = (messages: ChatMessage[]) =>
  messages.map((m) => `### ${m.role}\n${m.content}`).join('\n\n')

const FULL_PROFILE: IdeationProfile = {
  interests: ['Musik', 'Kochen'],
  skills: ['TypeScript', 'Figma'],
  availableTime: 'fewEvenings',
  learningGoal: 'Audio-Programmierung lernen.',
  frustrations: 'Ich vergesse ständig, welche Playlists ich schon gehört habe.',
  platform: 'web',
}

/** Nur ein Frust ist angegeben; alles andere bleibt leer. */
const MINIMAL_PROFILE: IdeationProfile = {
  ...EMPTY_PROFILE,
  frustrations: 'Papierlisten gehen beim Umzug verloren.',
}

const IDEA_A: Idea = {
  id: 'idea-a',
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

const IDEA_B: Idea = {
  id: 'idea-b',
  title: 'Rezept-Mixer',
  pitch: 'Kombiniert Vorräte mit Rezepten.',
  problem: '',
  audience: '',
  features: [],
  platform: '',
  effort: 'medium',
  novelty: 4,
  learningValue: 4,
  learningNote: 'Wie man Suchen über Listen baut.',
}

const SEEN = ['Playlist-Tagebuch', 'Rezept-Mixer']

const generate = (
  profile: IdeationProfile,
  avoidTitles: string[] = SEEN,
  language: 'de' | 'en' = 'de',
) =>
  buildGenerateIdeasMessages({
    profile,
    request: { kind: 'generate' },
    avoidTitles,
    language,
  })

const userText = (messages: ChatMessage[]) => messages.find((m) => m.role === 'user')?.content ?? ''

const systemText = (messages: ChatMessage[]) =>
  messages.find((m) => m.role === 'system')?.content ?? ''

// ---------------------------------------------------------------------------
// Golden Files: der vollständige Prompt bleibt stabil.
// Bei inhaltlichen Änderungen VERSION erhöhen und die Dateien neu erzeugen.
// ---------------------------------------------------------------------------

describe('buildGenerateIdeasMessages – Golden Files', () => {
  it('generate mit vollem Profil', async () => {
    await expect(asText(generate(FULL_PROFILE))).toMatchFileSnapshot(
      './__golden__/generate-ideas-generate-full.txt',
    )
  })

  it('generate mit minimalem Profil (nur Frust)', async () => {
    await expect(asText(generate(MINIMAL_PROFILE, []))).toMatchFileSnapshot(
      './__golden__/generate-ideas-generate-minimal.txt',
    )
  })

  it('moreLike', async () => {
    const messages = buildGenerateIdeasMessages({
      profile: FULL_PROFILE,
      request: { kind: 'moreLike', idea: IDEA_A },
      avoidTitles: SEEN,
      language: 'de',
    })
    await expect(asText(messages)).toMatchFileSnapshot('./__golden__/generate-ideas-more-like.txt')
  })

  it('refine einfacher', async () => {
    const messages = buildGenerateIdeasMessages({
      profile: FULL_PROFILE,
      request: { kind: 'refine', idea: IDEA_A, direction: 'simpler', note: '' },
      avoidTitles: [],
      language: 'de',
    })
    await expect(asText(messages)).toMatchFileSnapshot(
      './__golden__/generate-ideas-refine-simpler.txt',
    )
  })

  it('refine nach eigenem Wunsch', async () => {
    const messages = buildGenerateIdeasMessages({
      profile: FULL_PROFILE,
      request: {
        kind: 'refine',
        idea: IDEA_A,
        direction: 'custom',
        note: 'Mit Offline-Modus',
      },
      avoidTitles: [],
      language: 'de',
    })
    await expect(asText(messages)).toMatchFileSnapshot(
      './__golden__/generate-ideas-refine-custom.txt',
    )
  })

  it('combine', async () => {
    const messages = buildGenerateIdeasMessages({
      profile: FULL_PROFILE,
      request: { kind: 'combine', ideas: [IDEA_A, IDEA_B] },
      avoidTitles: [],
      language: 'de',
    })
    await expect(asText(messages)).toMatchFileSnapshot('./__golden__/generate-ideas-combine.txt')
  })
})

// ---------------------------------------------------------------------------
// Aufbau der Nachrichten
// ---------------------------------------------------------------------------

describe('buildGenerateIdeasMessages', () => {
  it('liefert eine System- und eine Nutzernachricht in dieser Reihenfolge', () => {
    expect(generate(FULL_PROFILE).map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('hat eine ID und eine Version', () => {
    expect(GENERATE_IDEAS_PROMPT_ID).toMatch(/^[a-z-]+$/)
    expect(Number.isInteger(GENERATE_IDEAS_PROMPT_VERSION)).toBe(true)
    expect(GENERATE_IDEAS_PROMPT_VERSION).toBeGreaterThanOrEqual(1)
  })

  it('nennt die Anzahl der Ideen je Runde', () => {
    expect(IDEAS_PER_ROUND).toBe(4)
    expect(ideaCountFor({ kind: 'generate' })).toBe(4)
    expect(ideaCountFor({ kind: 'moreLike', idea: IDEA_A })).toBe(4)
    expect(ideaCountFor({ kind: 'refine', idea: IDEA_A, direction: 'simpler', note: '' })).toBe(1)
    expect(ideaCountFor({ kind: 'combine', ideas: [IDEA_A, IDEA_B] })).toBe(1)
  })

  it('weist die Ausgabesprache aus', () => {
    expect(systemText(generate(FULL_PROFILE, SEEN, 'de'))).toContain('auf Deutsch')
    expect(systemText(generate(FULL_PROFILE, SEEN, 'en'))).toContain('auf Englisch')
  })

  it('schreibt „(keine Angabe)“ bei leeren Feldern des Fragebogens', () => {
    const user = userText(generate(MINIMAL_PROFILE, []))

    expect(user).toContain('- Interessen: (keine Angabe)')
    expect(user).toContain('- Fähigkeiten: (keine Angabe)')
    expect(user).toContain('- Lernziel: (keine Angabe)')
    expect(user).toContain('- Verfügbare Zeit: (keine Angabe)')
    expect(user).toContain('- Frust im Alltag: Papierlisten gehen beim Umzug verloren.')
    expect(user).toContain('- Plattform: egal, schlag etwas Passendes vor')
  })

  it('listet die zu vermeidenden Titel', () => {
    const user = userText(generate(FULL_PROFILE, SEEN))

    expect(user).toContain(
      '# Bereits gezeigte Ideen (nicht wiederholen)\n- Playlist-Tagebuch\n- Rezept-Mixer',
    )
  })

  it('schreibt „(keine)“, wenn noch keine Idee gezeigt wurde', () => {
    expect(userText(generate(FULL_PROFILE, []))).toContain(
      '# Bereits gezeigte Ideen (nicht wiederholen)\n(keine)',
    )
  })

  it('nennt das Vorbild nur bei moreLike', () => {
    const more = buildGenerateIdeasMessages({
      profile: FULL_PROFILE,
      request: { kind: 'moreLike', idea: IDEA_A },
      avoidTitles: [],
      language: 'de',
    })
    expect(userText(more)).toContain('# Vorbild\nTitel: Playlist-Tagebuch')
    expect(userText(generate(FULL_PROFILE))).not.toContain('# Vorbild')
  })

  it('nennt bei refine den Wunsch der Person; ohne Angabe „(keine Angabe)“', () => {
    const custom = buildGenerateIdeasMessages({
      profile: FULL_PROFILE,
      request: { kind: 'refine', idea: IDEA_A, direction: 'custom', note: 'Mit Offline-Modus' },
      avoidTitles: [],
      language: 'de',
    })
    const empty = buildGenerateIdeasMessages({
      profile: FULL_PROFILE,
      request: { kind: 'refine', idea: IDEA_A, direction: 'custom', note: '   ' },
      avoidTitles: [],
      language: 'de',
    })
    expect(userText(custom)).toContain('Wunsch der Person: Mit Offline-Modus')
    expect(userText(empty)).toContain('Wunsch der Person: (keine Angabe)')
  })

  it('stellt bei combine beide Ideen gegenüber', () => {
    const user = userText(
      buildGenerateIdeasMessages({
        profile: FULL_PROFILE,
        request: { kind: 'combine', ideas: [IDEA_A, IDEA_B] },
        avoidTitles: [],
        language: 'de',
      }),
    )
    expect(user).toContain('# Idee A\nTitel: Playlist-Tagebuch')
    expect(user).toContain('# Idee B\nTitel: Rezept-Mixer')
  })
})

describe('describeProfile und describeIdea', () => {
  it('beschreibt eine Idee ohne Funktionen mit „(keine)“', () => {
    expect(describeIdea(IDEA_B)).toContain('Kernfunktionen:\n  (keine)')
  })

  it('zeigt die Kernfunktionen als eingerückte Liste', () => {
    expect(describeIdea(IDEA_A)).toContain(
      'Kernfunktionen:\n  - Songs notieren\n  - Monatsrückblick',
    )
  })

  it('nennt Aufwand, Neuheit und Lernwert in einer Zeile', () => {
    expect(describeIdea(IDEA_A)).toContain('Aufwand: small, Neuheit: 3/5, Lernwert: 2/5')
  })

  it('beschreibt einen leeren Fragebogen vollständig mit Angaben', () => {
    const text = describeProfile(EMPTY_PROFILE)
    expect(text.split('\n')).toHaveLength(6)
    expect(text).not.toContain('undefined')
  })
})

// ---------------------------------------------------------------------------
// Antwortschema
// ---------------------------------------------------------------------------

describe('ideasResultSchema', () => {
  const candidate = {
    title: 'Playlist-Tagebuch',
    pitch: 'Notiert Songs.',
    problem: 'Man vergisst Songs.',
    audience: 'Musikfans',
    features: ['Songs notieren'],
    platform: 'Web-App',
    effort: 'small',
    novelty: 3,
    learningValue: 2,
    learningNote: 'Browser-Speicher.',
  }

  it('akzeptiert eine gültige Antwort und eine leere Liste', () => {
    expect(ideasResultSchema.safeParse({ ideas: [candidate] }).success).toBe(true)
    expect(ideasResultSchema.safeParse({ ideas: [] }).success).toBe(true)
  })

  it.each<[string, unknown]>([
    ['fehlender Titel', { ideas: [{ ...candidate, title: undefined }] }],
    ['Aufwand außerhalb der Liste', { ideas: [{ ...candidate, effort: 'huge' }] }],
    ['Funktionen als Text', { ideas: [{ ...candidate, features: 'Songs' }] }],
    ['Neuheit als Text', { ideas: [{ ...candidate, novelty: 'hoch' }] }],
    ['Ideen als Text', { ideas: 'Playlist-Tagebuch' }],
    ['fehlendes ideas-Feld', {}],
  ])('lehnt ab: %s', (_name, data) => {
    expect(ideasResultSchema.safeParse(data).success).toBe(false)
  })
})
