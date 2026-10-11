import { readSseData } from './sse'

const encoder = new TextEncoder()

function bodyOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

async function collect(body: ReadableStream<Uint8Array>): Promise<string[]> {
  const result: string[] = []
  for await (const data of readSseData(body)) result.push(data)
  return result
}

describe('readSseData', () => {
  it('liefert den Inhalt jeder data-Zeile', async () => {
    await expect(collect(bodyOf(encoder.encode('data: a\ndata: b\n')))).resolves.toEqual(['a', 'b'])
  })

  it('ignoriert Kommentarzeilen', async () => {
    await expect(
      collect(bodyOf(encoder.encode(': OPENROUTER PROCESSING\ndata: x\n'))),
    ).resolves.toEqual(['x'])
  })

  it('ignoriert andere Felder wie event, id und retry', async () => {
    const text = 'event: message\nid: 7\nretry: 100\ndata: y\n\n'

    await expect(collect(bodyOf(encoder.encode(text)))).resolves.toEqual(['y'])
  })

  it('entfernt führende Leerzeichen nach dem Doppelpunkt, aber nicht im Inhalt', async () => {
    await expect(
      collect(bodyOf(encoder.encode('data:ohne\ndata:   mit  Abstand\n'))),
    ).resolves.toEqual(['ohne', 'mit  Abstand'])
  })

  it('liest eine letzte data-Zeile ohne abschließenden Zeilenumbruch', async () => {
    await expect(collect(bodyOf(encoder.encode('data: a\ndata: letzte')))).resolves.toEqual([
      'a',
      'letzte',
    ])
  })

  it('entfernt ein CR am Ende der letzten Zeile', async () => {
    await expect(collect(bodyOf(encoder.encode('data: z\r')))).resolves.toEqual(['z'])
  })

  it('verarbeitet CRLF-Zeilenenden', async () => {
    await expect(collect(bodyOf(encoder.encode('data: a\r\n\r\ndata: b\r\n')))).resolves.toEqual([
      'a',
      'b',
    ])
  })

  it('übernimmt Doppelpunkte im Inhalt unverändert', async () => {
    await expect(collect(bodyOf(encoder.encode('data: {"a":1}\n')))).resolves.toEqual(['{"a":1}'])
  })

  it('liefert nichts für einen leeren Stream oder ein nicht-data-Ende', async () => {
    await expect(collect(bodyOf())).resolves.toEqual([])
    await expect(collect(bodyOf(encoder.encode('event: nur\n')))).resolves.toEqual([])
  })

  it('setzt Zeilen korrekt zusammen, die über mehrere Chunks verteilt sind', async () => {
    const chunks = ['da', 'ta: hel', 'lo\ndata: wel', 't\n'].map((part) => encoder.encode(part))

    await expect(collect(bodyOf(...chunks))).resolves.toEqual(['hello', 'welt'])
  })

  it('setzt UTF-8-Mehrbytezeichen korrekt zusammen, wenn sie zerschnitten sind', async () => {
    const bytes = encoder.encode('data: Größe 🚀\n')

    for (let split = 1; split < bytes.length; split++) {
      const parts = [bytes.slice(0, split), bytes.slice(split)]
      await expect(collect(bodyOf(...parts))).resolves.toEqual(['Größe 🚀'])
    }
  })

  it('setzt UTF-8 korrekt zusammen, wenn jedes Byte einzeln kommt', async () => {
    const bytes = encoder.encode('data: Größe 🚀\n')
    const singleBytes = Array.from(bytes, (byte) => new Uint8Array([byte]))

    await expect(collect(bodyOf(...singleBytes))).resolves.toEqual(['Größe 🚀'])
  })
})
