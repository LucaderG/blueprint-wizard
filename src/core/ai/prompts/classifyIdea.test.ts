import { SECTION_IDS } from '@/core/blueprint/sections'
import { toJsonSchemaFormat } from '../structured'
import {
  buildClassifyIdeaMessages,
  CLASSIFY_IDEA_PROMPT_ID,
  CLASSIFY_IDEA_PROMPT_VERSION,
  classificationSchema,
  type ClassifyIdeaInput,
} from './classifyIdea'

const input = (overrides: Partial<ClassifyIdeaInput> = {}): ClassifyIdeaInput => ({
  text: 'Eine App für Rezepte',
  entryPoint: 'partialIdea',
  language: 'de',
  ...overrides,
})

const validClassification = {
  projectName: 'Wochenplaner',
  summary: 'Eine App für die Wochenplanung.',
  sections: [{ id: 'problem', content: 'Planung fällt schwer', maturity: 'vague' }],
}

describe('buildClassifyIdeaMessages', () => {
  it('liefert eine System- und eine Nutzernachricht in dieser Reihenfolge', () => {
    const messages = buildClassifyIdeaMessages(input())

    expect(messages.map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('nennt alle Blueprint-Abschnitte im System-Prompt', () => {
    const [system] = buildClassifyIdeaMessages(input())

    for (const id of SECTION_IDS) {
      expect(system?.content).toContain(`- ${id}:`)
    }
  })

  it('passt den Kontext an den Einstiegspunkt an', () => {
    const systems = (['noIdea', 'partialIdea', 'almostDone'] as const).map(
      (entryPoint) => buildClassifyIdeaMessages(input({ entryPoint }))[0]?.content ?? '',
    )

    expect(new Set(systems).size).toBe(3)
    expect(systems[0]).toContain('noch keine konkrete Idee')
    expect(systems[1]).toContain('Teil-Idee')
    expect(systems[2]).toContain('fast fertiges Konzept')
  })

  it('weist die Ausgabesprache aus', () => {
    const [de] = buildClassifyIdeaMessages(input({ language: 'de' }))
    const [en] = buildClassifyIdeaMessages(input({ language: 'en' }))

    expect(de?.content).toContain('Schreibe alle Inhalte auf Deutsch.')
    expect(en?.content).toContain('Schreibe alle Inhalte auf Englisch.')
  })

  it('schneidet den Text der Person ab und setzt ihn in Anführungszeichen', () => {
    const [, user] = buildClassifyIdeaMessages(input({ text: '  \n Mein Text \t\n ' }))

    expect(user?.content).toBe('Text der Person:\n"""\nMein Text\n"""')
  })
})

describe('classificationSchema', () => {
  it('akzeptiert gültige Daten, auch mit fehlendem Projektnamen', () => {
    expect(classificationSchema.safeParse(validClassification).success).toBe(true)
    expect(
      classificationSchema.safeParse({ ...validClassification, projectName: null }).success,
    ).toBe(true)
    expect(classificationSchema.safeParse({ ...validClassification, sections: [] }).success).toBe(
      true,
    )
  })

  it('lehnt doppelte Abschnitts-IDs ab', () => {
    const duplicated = {
      ...validClassification,
      sections: [validClassification.sections[0], validClassification.sections[0]],
    }

    const result = classificationSchema.safeParse(duplicated)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['sections'])
  })

  it('lehnt unbekannte Abschnitts-IDs ab', () => {
    const unknown = {
      ...validClassification,
      sections: [{ id: 'marketing', content: 'x', maturity: 'vague' }],
    }

    expect(classificationSchema.safeParse(unknown).success).toBe(false)
  })

  it('lehnt ungültige Reifegrade ab', () => {
    const invalid = {
      ...validClassification,
      sections: [{ id: 'problem', content: 'x', maturity: 'sicher' }],
    }

    expect(classificationSchema.safeParse(invalid).success).toBe(false)
  })

  it('verlangt projectName als Feld (kein optionales Feld im Strict-Modus)', () => {
    const { projectName: _omitted, ...withoutName } = validClassification

    expect(classificationSchema.safeParse(withoutName).success).toBe(false)
  })
})

describe('Strict-JSON-Schema der Einordnung', () => {
  it('ist ein Objektschema, in dem alle Felder Pflicht sind', () => {
    const format = toJsonSchemaFormat('idea_classification', classificationSchema)
    const schema = format.schema

    expect(format.name).toBe('idea_classification')
    expect(schema).not.toHaveProperty('$schema')
    expect(schema['type']).toBe('object')
    expect(Object.keys(schema['properties'] as object)).toEqual(
      expect.arrayContaining(['projectName', 'summary', 'sections']),
    )
    expect(schema['required']).toEqual(
      expect.arrayContaining(['projectName', 'summary', 'sections']),
    )
    expect(schema['additionalProperties']).toBe(false)
  })
})

describe('Prompt-Version', () => {
  it('ist Version 1 mit fester ID', () => {
    expect(CLASSIFY_IDEA_PROMPT_VERSION).toBe(1)
    expect(CLASSIFY_IDEA_PROMPT_ID).toBe('classify-idea')
  })
})
