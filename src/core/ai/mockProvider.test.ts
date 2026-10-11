import { AiError } from './errors'
import { MockAiProvider } from './mockProvider'

const messages = [{ role: 'user' as const, content: 'Hallo' }]

describe('MockAiProvider', () => {
  it('liefert vorbereitete Antworten in der Reihenfolge der Warteschlange', async () => {
    const provider = new MockAiProvider(['erste', 'zweite'])

    await expect(provider.complete({ messages })).resolves.toMatchObject({ text: 'erste' })
    await expect(provider.complete({ messages })).resolves.toMatchObject({ text: 'zweite' })
  })

  it('wandelt Text in ein Ergebnis mit Mock-Modell um', async () => {
    const provider = new MockAiProvider(['Antwort'])

    await expect(provider.complete({ messages })).resolves.toEqual({
      text: 'Antwort',
      model: 'mock/model',
    })
  })

  it('gibt ein vorbereitetes Ergebnis unverändert zurück', async () => {
    const result = {
      text: 'x',
      model: 'provider/m',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    }
    const provider = new MockAiProvider([result])

    await expect(provider.complete({ messages })).resolves.toEqual(result)
  })

  it('wirft einen vorbereiteten AiError unverändert', async () => {
    const error = new AiError('rateLimited', 'Limit erreicht')
    const provider = new MockAiProvider([error])

    await expect(provider.complete({ messages })).rejects.toBe(error)
  })

  it('merkt sich alle Anfragen', async () => {
    const provider = new MockAiProvider(['a', 'b'])
    const first = { messages, temperature: 0.1 }
    const second = { messages: [{ role: 'system' as const, content: 'x' }] }

    await provider.complete(first)
    await provider.complete(second)

    expect(provider.requests).toEqual([first, second])
  })

  it('wirft einen Fehler, wenn keine Antwort mehr vorbereitet ist', async () => {
    const provider = new MockAiProvider()

    await expect(provider.complete({ messages })).rejects.toThrow('keine Antwort mehr')
    expect(provider.requests).toHaveLength(1)
  })

  it('liefert bei abgebrochenem Signal AiError aborted und verbraucht keine Antwort', async () => {
    const provider = new MockAiProvider(['bleibt in der Warteschlange'])
    const controller = new AbortController()
    controller.abort()

    const error = await provider.complete({ messages, signal: controller.signal }).catch((e) => e)

    expect(error).toBeInstanceOf(AiError)
    expect(error.code).toBe('aborted')
    await expect(provider.complete({ messages })).resolves.toMatchObject({
      text: 'bleibt in der Warteschlange',
    })
  })

  it('streamt Wortstücke, deren Verkettung dem Text entspricht', async () => {
    const text = 'Hallo  Welt\nneue   Zeile '
    const provider = new MockAiProvider([text])
    const pieces: string[] = []

    const result = await provider.stream({ messages }, (piece) => pieces.push(piece))

    expect(pieces.join('')).toBe(text)
    expect(pieces).toEqual(['Hallo  ', 'Welt\n', 'neue   ', 'Zeile '])
    expect(result.text).toBe(text)
  })

  it('streamt Leerraum als eigenes Stück', async () => {
    const provider = new MockAiProvider([' \n '])
    const pieces: string[] = []

    await provider.stream({ messages }, (piece) => pieces.push(piece))

    expect(pieces.join('')).toBe(' \n ')
  })

  it('streamt keine Stücke bei leerem Text', async () => {
    const provider = new MockAiProvider([''])
    const onDelta = vi.fn()

    await provider.stream({ messages }, onDelta)

    expect(onDelta).not.toHaveBeenCalled()
  })

  it('wirft beim Streamen einen vorbereiteten AiError ohne Teilstücke', async () => {
    const provider = new MockAiProvider([new AiError('network', 'weg')])
    const onDelta = vi.fn()

    await expect(provider.stream({ messages }, onDelta)).rejects.toMatchObject({ code: 'network' })
    expect(onDelta).not.toHaveBeenCalled()
  })

  it('nimmt später mit enqueue weitere Antworten auf', async () => {
    const provider = new MockAiProvider(['eins'])
    provider.enqueue('zwei', 'drei')

    const texts = [
      (await provider.complete({ messages })).text,
      (await provider.complete({ messages })).text,
      (await provider.complete({ messages })).text,
    ]

    expect(texts).toEqual(['eins', 'zwei', 'drei'])
  })
})
