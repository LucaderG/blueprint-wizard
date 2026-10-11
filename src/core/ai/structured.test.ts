import { z } from 'zod'
import { AiError } from './errors'
import { MockAiProvider } from './mockProvider'
import { extractJson, generateStructured, toJsonSchemaFormat } from './structured'
import type { ChatMessage } from './types'

const schema = z.object({ title: z.string(), count: z.number().int() })
const messages: ChatMessage[] = [
  { role: 'system', content: 'Du bist hilfreich.' },
  { role: 'user', content: 'Analysiere das.' },
]
const validJson = '{"title":"Blueprint","count":3}'

describe('generateStructured', () => {
  it('nutzt eine gültige erste Antwort ohne Reparaturversuch', async () => {
    const provider = new MockAiProvider([validJson])

    const result = await generateStructured({ provider, schema, name: 'test', messages })

    expect(result.data).toEqual({ title: 'Blueprint', count: 3 })
    expect(result.calls).toHaveLength(1)
    expect(provider.requests).toHaveLength(1)
  })

  it('entpackt eine Antwort in ```json-Fences', async () => {
    const provider = new MockAiProvider(['```json\n' + validJson + '\n```'])

    const result = await generateStructured({ provider, schema, name: 'test', messages })

    expect(result.data.title).toBe('Blueprint')
    expect(provider.requests).toHaveLength(1)
  })

  it('bittet bei ungültigem JSON einmal um Reparatur mit dem ursprünglichen Verlauf', async () => {
    const bad = 'Hier ist {kaputt'
    const provider = new MockAiProvider([bad, validJson])

    const result = await generateStructured({ provider, schema, name: 'test', messages })

    expect(result.data).toEqual({ title: 'Blueprint', count: 3 })
    expect(result.calls).toHaveLength(2)
    expect(provider.requests).toHaveLength(2)

    const repair = provider.requests[1]?.messages ?? []
    expect(repair.slice(0, messages.length)).toEqual(messages)
    expect(repair[messages.length]).toEqual({ role: 'assistant', content: bad })
    const instruction = repair[messages.length + 1]
    expect(instruction?.role).toBe('user')
    expect(instruction?.content).toContain('kein gültiges JSON')
  })

  it('bittet bei schema-ungültiger Antwort um Reparatur mit Fehlerbeschreibung', async () => {
    const wrong = '{"title":"Blueprint","count":"drei"}'
    const provider = new MockAiProvider([wrong, validJson])

    const result = await generateStructured({ provider, schema, name: 'test', messages })

    expect(result.data.count).toBe(3)
    const instruction = provider.requests[1]?.messages.at(-1)
    expect(instruction?.role).toBe('user')
    expect(instruction?.content).toContain('passt nicht zum geforderten JSON-Schema')
    expect(instruction?.content).toContain('count')
  })

  it('wirft invalidResponse, wenn auch die Reparatur ungültig ist', async () => {
    const provider = new MockAiProvider(['kaputt', '{"title":1}'])

    const error = await generateStructured({
      provider,
      schema,
      name: 'blueprint_analysis',
      messages,
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AiError)
    expect(error).toMatchObject({ code: 'invalidResponse' })
    expect((error as Error).message).toContain('blueprint_analysis')
    expect(provider.requests).toHaveLength(2)
  })

  it('übergibt das JSON-Schema ohne $schema mit additionalProperties false', async () => {
    const provider = new MockAiProvider([validJson])

    await generateStructured({ provider, schema, name: 'test_schema', messages })

    const format = provider.requests[0]?.jsonSchema
    expect(format?.name).toBe('test_schema')
    expect(format?.schema).not.toHaveProperty('$schema')
    expect(format?.schema).toMatchObject({ type: 'object', additionalProperties: false })
  })

  it('leitet Temperatur und Abbruchsignal an beide Aufrufe weiter', async () => {
    const provider = new MockAiProvider(['kaputt', validJson])
    const controller = new AbortController()

    await generateStructured({
      provider,
      schema,
      name: 'test',
      messages,
      temperature: 0.2,
      signal: controller.signal,
    })

    for (const request of provider.requests) {
      expect(request.temperature).toBe(0.2)
      expect(request.signal).toBe(controller.signal)
    }
  })

  it('reicht Fehler des Anbieters unverändert weiter', async () => {
    const error = new AiError('rateLimited', 'Limit')
    const provider = new MockAiProvider([error])

    await expect(generateStructured({ provider, schema, name: 'test', messages })).rejects.toBe(
      error,
    )
  })

  it('reicht Fehler des Anbieters beim Reparaturversuch unverändert weiter', async () => {
    const error = new AiError('timeout', 'Zu langsam')
    const provider = new MockAiProvider(['kaputt', error])

    await expect(generateStructured({ provider, schema, name: 'test', messages })).rejects.toBe(
      error,
    )
  })
})

describe('toJsonSchemaFormat', () => {
  it('liefert Name und Schema ohne $schema-Eintrag', () => {
    const format = toJsonSchemaFormat('mein_schema', z.object({ a: z.string() }))

    expect(format.name).toBe('mein_schema')
    expect(format.schema).not.toHaveProperty('$schema')
    expect(format.schema).toMatchObject({
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
    })
  })
})

describe('extractJson', () => {
  it('parst reines JSON', () => {
    expect(extractJson('  {"a":1}  ')).toEqual({ a: 1 })
  })

  it('entpackt ```json-Blöcke', () => {
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 })
  })

  it('entpackt Blöcke ohne Sprachangabe', () => {
    expect(extractJson('```\n[1,2]\n```')).toEqual([1, 2])
  })

  it('ignoriert Text um den Block herum', () => {
    expect(extractJson('Hier das Ergebnis:\n```JSON\n{"a":3}\n```\nFertig.')).toEqual({ a: 3 })
  })

  it('wirft bei ungültigem JSON', () => {
    expect(() => extractJson('kein json')).toThrow(SyntaxError)
  })
})
