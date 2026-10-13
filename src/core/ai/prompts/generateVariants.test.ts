import type { ChatMessage } from '../types'
import { toJsonSchemaFormat } from '../structured'
import {
  buildGenerateVariantsMessages,
  GENERATE_VARIANTS_PROMPT_ID,
  GENERATE_VARIANTS_PROMPT_VERSION,
  MAX_PROFILE_FEATURES,
  MAX_PROFILE_RISKS,
  MIN_PROFILE_FEATURES,
  MIN_PROFILE_RISKS,
  variantsResultSchema,
} from './generateVariants'

// ---------------------------------------------------------------------------
// Feste Beispiele
// ---------------------------------------------------------------------------

/** Textform der Nachrichten, mit der die Golden Files verglichen werden. */
const asText = (messages: ChatMessage[]) =>
  messages.map((m) => `### ${m.role}\n${m.content}`).join('\n\n')

const IDEA = 'Eine App, mit der Fans ihre Lieblingsband auf Tour begleiten'

const systemText = (messages: ChatMessage[]) =>
  messages.find((m) => m.role === 'system')?.content ?? ''

const userText = (messages: ChatMessage[]) => messages.find((m) => m.role === 'user')?.content ?? ''

const validCandidate = {
  title: 'Tour-Begleiter',
  pitch: 'Begleitet Fans durch die Tour ihrer Band.',
  problem: 'Konzertinfos sind verstreut.',
  audience: 'Fans, die oft auf Konzerte gehen',
  features: ['Tourdaten', 'Erinnerungen', 'Setlist', 'Karte', 'Teilen'],
  platform: 'Web-App mit PWA',
  monetization: {
    model: 'Freemium',
    priceRange: '2–5 € im Monat',
    reason: 'Grundfunktionen gratis, Komfort bezahlt.',
  },
  effort: 'medium',
  risks: ['Datenquellen für Tourdaten fehlen', 'Geringe Nutzerzahl'],
} as const

// ---------------------------------------------------------------------------
// Golden Files: der vollständige Prompt bleibt stabil.
// Bei inhaltlichen Änderungen VERSION erhöhen und die Dateien neu erzeugen.
// ---------------------------------------------------------------------------

describe('buildGenerateVariantsMessages – Golden Files', () => {
  it('eine Variante auf Deutsch', async () => {
    const messages = buildGenerateVariantsMessages({ idea: IDEA, count: 1, language: 'de' })
    await expect(asText(messages)).toMatchFileSnapshot('./__golden__/generate-variants-one.txt')
  })

  it('drei Varianten auf Deutsch', async () => {
    const messages = buildGenerateVariantsMessages({ idea: IDEA, count: 3, language: 'de' })
    await expect(asText(messages)).toMatchFileSnapshot('./__golden__/generate-variants-three.txt')
  })

  it('zwei Varianten auf Englisch', async () => {
    const messages = buildGenerateVariantsMessages({ idea: IDEA, count: 2, language: 'en' })
    await expect(asText(messages)).toMatchFileSnapshot('./__golden__/generate-variants-english.txt')
  })
})

// ---------------------------------------------------------------------------
// Aufbau der Nachrichten
// ---------------------------------------------------------------------------

describe('buildGenerateVariantsMessages', () => {
  it('liefert eine System- und eine Nutzernachricht in dieser Reihenfolge', () => {
    const messages = buildGenerateVariantsMessages({ idea: IDEA, count: 1, language: 'de' })

    expect(messages.map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('verlangt bei einer Variante genau einen Steckbrief', () => {
    const messages = buildGenerateVariantsMessages({ idea: IDEA, count: 1, language: 'de' })

    expect(userText(messages)).toContain('genau einen Steckbrief')
    expect(userText(messages)).not.toContain('Steckbriefe')
  })

  it('verlangt bei drei Varianten genau 3 Steckbriefe', () => {
    const messages = buildGenerateVariantsMessages({ idea: IDEA, count: 3, language: 'de' })

    expect(userText(messages)).toContain('genau 3 Steckbriefe')
  })

  it('kürzt die Idee und setzt sie in Anführungszeichen', () => {
    const messages = buildGenerateVariantsMessages({
      idea: '  \n Eine Idee \t\n ',
      count: 1,
      language: 'de',
    })

    expect(userText(messages)).toContain('# Idee der Person\n"""\nEine Idee\n"""')
  })

  it('weist die Ausgabesprache aus', () => {
    const de = buildGenerateVariantsMessages({ idea: IDEA, count: 1, language: 'de' })
    const en = buildGenerateVariantsMessages({ idea: IDEA, count: 1, language: 'en' })

    expect(systemText(de)).toContain('Schreibe alle Texte auf Deutsch.')
    expect(systemText(en)).toContain('Schreibe alle Texte auf Englisch.')
  })

  it('nennt die Spannen für Funktionen und Risiken im System-Prompt', () => {
    const system = systemText(
      buildGenerateVariantsMessages({ idea: IDEA, count: 1, language: 'de' }),
    )

    expect(MIN_PROFILE_FEATURES).toBe(5)
    expect(MAX_PROFILE_FEATURES).toBe(8)
    expect(MIN_PROFILE_RISKS).toBe(2)
    expect(MAX_PROFILE_RISKS).toBe(3)
    expect(system).toContain(`${MIN_PROFILE_FEATURES} bis ${MAX_PROFILE_FEATURES} Kernfunktionen`)
    expect(system).toContain(`${MIN_PROFILE_RISKS} bis ${MAX_PROFILE_RISKS} wichtigste Risiken`)
  })

  it('hat eine ID und eine Version', () => {
    expect(GENERATE_VARIANTS_PROMPT_VERSION).toBe(1)
    expect(GENERATE_VARIANTS_PROMPT_ID).toBe('generate-variants')
  })
})

// ---------------------------------------------------------------------------
// Antwortschema
// ---------------------------------------------------------------------------

describe('variantsResultSchema', () => {
  it('akzeptiert eine gültige Antwort', () => {
    expect(variantsResultSchema.safeParse({ variants: [validCandidate] }).success).toBe(true)
  })

  it('lehnt einen unbekannten Aufwand ab', () => {
    const invalid = { variants: [{ ...validCandidate, effort: 'huge' }] }

    expect(variantsResultSchema.safeParse(invalid).success).toBe(false)
  })

  it('lehnt eine Variante ohne Monetarisierung ab', () => {
    const { monetization: _omitted, ...withoutMonetization } = validCandidate
    const invalid = { variants: [withoutMonetization] }

    expect(variantsResultSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('Strict-JSON-Schema der Varianten', () => {
  it('ist ein strenges Objektschema, das variants verlangt', () => {
    const format = toJsonSchemaFormat('project_variants', variantsResultSchema)
    const schema = format.schema

    expect(format.name).toBe('project_variants')
    expect(schema['type']).toBe('object')
    expect(schema['additionalProperties']).toBe(false)
    expect(schema['required']).toEqual(expect.arrayContaining(['variants']))
  })
})
