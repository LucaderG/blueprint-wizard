import { SECTION_IDS } from '@/core/blueprint/sections'
import type { ProjectProfile } from '@/core/blueprint/schema'
import type { ChatMessage } from '../types'
import {
  buildExpandProfileMessages,
  describeProjectProfile,
  EXPAND_PROFILE_PROMPT_ID,
  EXPAND_PROFILE_PROMPT_VERSION,
} from './expandProfile'

// ---------------------------------------------------------------------------
// Feste Beispiele
// ---------------------------------------------------------------------------

/** Textform der Nachrichten, mit der die Golden Files verglichen werden. */
const asText = (messages: ChatMessage[]) =>
  messages.map((m) => `### ${m.role}\n${m.content}`).join('\n\n')

const systemText = (messages: ChatMessage[]) =>
  messages.find((m) => m.role === 'system')?.content ?? ''

const userText = (messages: ChatMessage[]) => messages.find((m) => m.role === 'user')?.content ?? ''

const FULL_PROFILE: ProjectProfile = {
  pitch:
    'Begleitet Fans durch die Tour ihrer Lieblingsband mit Terminen, Erinnerungen und Setlists.',
  problem: 'Tourtermine und Erinnerungen sind über viele Apps und Chats verstreut.',
  audience: 'Konzertbesucher, die ihre Lieblingsband regelmäßig live sehen.',
  features: ['Tourtermine anzeigen', 'Konzerterinnerungen festhalten', 'Setlists speichern'],
  platform: 'Web-App (PWA) mit React und IndexedDB',
  monetization: {
    model: 'Freemium',
    priceRange: '2–5 € im Monat',
    reason: 'Grundfunktionen bleiben gratis, Komfort kostet.',
  },
  effort: 'medium',
  risks: ['Tourdaten sind schwer zu beschaffen', 'Wenige Nutzer am Anfang'],
}

const SPARSE_PROFILE: ProjectProfile = {
  pitch: 'Eine Idee für Fans auf Tour.',
  problem: '',
  audience: '',
  features: [],
  platform: '',
  monetization: { model: '', priceRange: '', reason: '' },
  effort: 'small',
  risks: [],
}

const expand = (profile: ProjectProfile, language: 'de' | 'en' = 'de') =>
  buildExpandProfileMessages({ name: 'Tour-Begleiter', profile, language })

// ---------------------------------------------------------------------------
// Golden Files: der vollständige Prompt bleibt stabil.
// Bei inhaltlichen Änderungen VERSION erhöhen und die Dateien neu erzeugen.
// ---------------------------------------------------------------------------

describe('buildExpandProfileMessages – Golden Files', () => {
  it('vollständiger Steckbrief', async () => {
    await expect(asText(expand(FULL_PROFILE))).toMatchFileSnapshot(
      './__golden__/expand-profile-full.txt',
    )
  })

  it('lückenhafter Steckbrief mit leeren Feldern', async () => {
    await expect(asText(expand(SPARSE_PROFILE))).toMatchFileSnapshot(
      './__golden__/expand-profile-sparse.txt',
    )
  })
})

// ---------------------------------------------------------------------------
// Aufbau der Nachrichten
// ---------------------------------------------------------------------------

describe('buildExpandProfileMessages', () => {
  it('liefert eine System- und eine Nutzernachricht in dieser Reihenfolge', () => {
    expect(expand(FULL_PROFILE).map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('nennt alle Blueprint-Abschnitte im System-Prompt', () => {
    const system = systemText(expand(FULL_PROFILE))

    for (const id of SECTION_IDS) {
      expect(system).toContain(`- ${id}:`)
    }
  })

  it('weist die Ausgabesprache aus', () => {
    expect(systemText(expand(FULL_PROFILE, 'de'))).toContain('Schreibe alle Inhalte auf Deutsch.')
    expect(systemText(expand(FULL_PROFILE, 'en'))).toContain('auf Englisch')
  })

  it('hat eine ID und eine Version', () => {
    expect(EXPAND_PROFILE_PROMPT_VERSION).toBe(1)
    expect(EXPAND_PROFILE_PROMPT_ID).toBe('expand-profile')
  })
})

describe('describeProjectProfile', () => {
  it('schreibt „(keine Angabe)“ bei leeren Textfeldern', () => {
    const text = describeProjectProfile('Tour-Begleiter', SPARSE_PROFILE)

    expect(text).toContain('Problem: (keine Angabe)')
    expect(text).toContain('Zielgruppe: (keine Angabe)')
    expect(text).toContain('Plattform: (keine Angabe)')
    expect(text).toContain(
      'Monetarisierung: (keine Angabe); Preisrahmen (Annahme): (keine Angabe); Begründung: (keine Angabe)',
    )
  })

  it('schreibt „(keine)“ bei leeren Listen', () => {
    const text = describeProjectProfile('Tour-Begleiter', SPARSE_PROFILE)

    expect(text).toContain('Kernfunktionen:\n  (keine)')
    expect(text).toContain('Risiken:\n  (keine)')
  })

  it('listet Funktionen und Risiken als eingerückte Liste', () => {
    const text = describeProjectProfile('Tour-Begleiter', FULL_PROFILE)

    expect(text).toContain('Kernfunktionen:\n  - Tourtermine anzeigen\n')
    expect(text).toContain('Risiken:\n  - Tourdaten sind schwer zu beschaffen\n')
  })

  it('beschreibt einen großen Aufwand als „groß“', () => {
    const text = describeProjectProfile('Tour-Begleiter', { ...FULL_PROFILE, effort: 'large' })

    expect(text).toContain('Aufwand: groß (mehrere Wochen und mehr)')
  })

  it('nennt den Titel in der ersten Zeile', () => {
    expect(describeProjectProfile('Tour-Begleiter', FULL_PROFILE).split('\n')[0]).toBe(
      'Titel: Tour-Begleiter',
    )
  })
})

// Die Nutzernachricht trägt den Steckbrief als Abschnitt.
describe('Nutzernachricht', () => {
  it('enthält den Steckbrief unter „Steckbrief“', () => {
    expect(userText(expand(FULL_PROFILE))).toContain(
      `# Steckbrief\n${describeProjectProfile('Tour-Begleiter', FULL_PROFILE)}`,
    )
  })
})
