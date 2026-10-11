import { delay, http, HttpResponse } from 'msw'
import {
  VALID_TEST_KEY,
  completionFixture,
  keyFixture,
  modelsFixture,
  openRouterHandlers,
} from '@/test/msw/openrouter'
import { server } from '@/test/msw/server'
import { AiError } from './errors'
import {
  listOpenRouterModels,
  OPENROUTER_BASE_URL,
  OpenRouterProvider,
  verifyOpenRouterKey,
} from './openRouter'

const CHAT_URL = `${OPENROUTER_BASE_URL}/chat/completions`
const MODELS_URL = `${OPENROUTER_BASE_URL}/models`
const KEY_URL = `${OPENROUTER_BASE_URL}/key`
const MODEL = 'anthropic/claude-sonnet-5.5'
const messages = [{ role: 'user' as const, content: 'Hi' }]

type ProviderOptions = ConstructorParameters<typeof OpenRouterProvider>[0]

function createProvider(overrides: Partial<ProviderOptions> = {}): OpenRouterProvider {
  return new OpenRouterProvider({ apiKey: VALID_TEST_KEY, model: MODEL, ...overrides })
}

async function errorOf(promise: Promise<unknown>): Promise<AiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AiError) return error
    throw error
  }
  throw new Error('Kein Fehler geworfen')
}

/** Antwortet auf Chat-Anfragen mit dem übergebenen JSON-Body und Status. */
function respondChat(json: object, init: ResponseInit = {}) {
  server.use(http.post(CHAT_URL, () => HttpResponse.json(json, init)))
}

/** Antwortet auf Chat-Anfragen mit einem SSE-Stream; `chunkSize` zerlegt die Bytes. */
function respondStream(text: string, chunkSize?: number) {
  const bytes = new TextEncoder().encode(text)
  const size = chunkSize ?? Math.max(bytes.length, 1)
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size))
      controller.close()
    },
  })
  server.use(
    http.post(
      CHAT_URL,
      () => new HttpResponse(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    ),
  )
}

const modelChunk = (content: string) =>
  `data: ${JSON.stringify({ model: MODEL, choices: [{ delta: { content } }] })}\n\n`

const usageChunk = `data: ${JSON.stringify({
  model: MODEL,
  choices: [],
  usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20, cost: 0.0001 },
})}\n\n`

const STREAM_PAYLOAD =
  ': OPENROUTER PROCESSING\n\n' +
  modelChunk('Hal') +
  modelChunk('lo') +
  modelChunk(' Welt') +
  usageChunk +
  'data: [DONE]\n\n'

beforeEach(() => {
  server.use(...openRouterHandlers)
})

describe('OpenRouterProvider', () => {
  describe('Konstruktor', () => {
    it.each(['', '   ', '\n\t'])('lehnt leeren Key %j ab', (apiKey) => {
      expect(() => new OpenRouterProvider({ apiKey, model: MODEL })).toThrow(AiError)
      expect(() => new OpenRouterProvider({ apiKey, model: MODEL })).toThrow(
        expect.objectContaining({ code: 'missingKey' }),
      )
    })
  })

  describe('complete', () => {
    it('sendet eine POST-Anfrage mit getrimmtem Bearer-Key und Standard-Headern', async () => {
      let request: Request | undefined
      server.use(
        http.post(CHAT_URL, ({ request: incoming }) => {
          request = incoming
          return HttpResponse.json(completionFixture('Hallo!'))
        }),
      )

      await createProvider({ apiKey: `  ${VALID_TEST_KEY}  ` }).complete({ messages })

      expect(request?.method).toBe('POST')
      expect(request?.headers.get('Authorization')).toBe(`Bearer ${VALID_TEST_KEY}`)
      expect(request?.headers.get('Content-Type')).toBe('application/json')
      expect(request?.headers.get('HTTP-Referer')).toBeNull()
      expect(request?.headers.get('X-Title')).toBeNull()
    })

    it('sendet Modell, Nachrichten, Parameter und App-Header', async () => {
      let request: Request | undefined
      let body: Record<string, unknown> | undefined
      server.use(
        http.post(CHAT_URL, async ({ request: incoming }) => {
          request = incoming
          body = (await incoming.json()) as Record<string, unknown>
          return HttpResponse.json(completionFixture('Hallo!'))
        }),
      )
      const provider = createProvider({
        appUrl: 'https://blueprint.example',
        appTitle: 'Blueprint Wizard',
      })

      await provider.complete({ messages, temperature: 0.3, maxTokens: 500 })

      expect(request?.headers.get('HTTP-Referer')).toBe('https://blueprint.example')
      expect(request?.headers.get('X-Title')).toBe('Blueprint Wizard')
      expect(body).toEqual({
        model: MODEL,
        messages,
        stream: false,
        temperature: 0.3,
        max_tokens: 500,
      })
    })

    it('lässt optionale Parameter weg, wenn sie fehlen', async () => {
      let body: Record<string, unknown> | undefined
      server.use(
        http.post(CHAT_URL, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(completionFixture('ok'))
        }),
      )

      await createProvider().complete({ messages })

      expect(body).not.toHaveProperty('temperature')
      expect(body).not.toHaveProperty('max_tokens')
      expect(body).not.toHaveProperty('response_format')
      expect(body).not.toHaveProperty('provider')
    })

    it('liefert Text, Modell und Nutzung mit Kosten in camelCase', async () => {
      respondChat(completionFixture('Hallo Welt', 'openai/gpt-x'))

      await expect(createProvider().complete({ messages })).resolves.toEqual({
        text: 'Hallo Welt',
        model: 'openai/gpt-x',
        usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20, cost: 0.0001 },
      })
    })

    it('lässt usage und cost weg, wenn der Anbieter sie nicht meldet', async () => {
      const { usage: _usage, ...withoutUsage } = completionFixture('ohne Nutzung')
      respondChat(withoutUsage)

      const result = await createProvider().complete({ messages })

      expect(result).toEqual({ text: 'ohne Nutzung', model: MODEL, usage: undefined })
    })

    it('übernimmt Nutzung ohne cost ohne cost-Feld', async () => {
      respondChat({
        ...completionFixture('x'),
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      })

      const result = await createProvider().complete({ messages })

      expect(result.usage).toStrictEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3 })
    })

    it('liefert leeren Text bei null-Inhalt', async () => {
      respondChat({
        model: MODEL,
        choices: [{ message: { role: 'assistant', content: null } }],
      })

      await expect(createProvider().complete({ messages })).resolves.toMatchObject({ text: '' })
    })

    it('sendet jsonSchema als response_format mit strict und require_parameters', async () => {
      let body: Record<string, unknown> | undefined
      server.use(
        http.post(CHAT_URL, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(completionFixture('{"a":1}'))
        }),
      )
      const schema = { type: 'object', properties: { a: { type: 'number' } } }

      await createProvider().complete({
        messages,
        jsonSchema: { name: 'blueprint_analysis', schema },
      })

      expect(body?.response_format).toEqual({
        type: 'json_schema',
        json_schema: { name: 'blueprint_analysis', strict: true, schema },
      })
      expect(body?.provider).toEqual({ require_parameters: true })
    })

    it.each([
      [400, 'badRequest'],
      [401, 'invalidKey'],
      [402, 'insufficientCredits'],
      [403, 'forbidden'],
      [404, 'modelUnavailable'],
      [408, 'timeout'],
      [429, 'rateLimited'],
      [500, 'unknown'],
      [502, 'modelUnavailable'],
      [503, 'modelUnavailable'],
      [504, 'timeout'],
    ])('bildet HTTP %i auf %s ab', async (status, code) => {
      respondChat({ error: { message: `Fehler ${status}` } }, { status })

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error).toBeInstanceOf(AiError)
      expect(error.code).toBe(code)
      expect(error.status).toBe(status)
      expect(error.message).toBe(`Fehler ${status}`)
    })

    it('liest Retry-After bei 429 als Sekunden aus', async () => {
      respondChat(
        { error: { message: 'Zu viele Anfragen' } },
        { status: 429, headers: { 'Retry-After': '42' } },
      )

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.code).toBe('rateLimited')
      expect(error.retryAfterSeconds).toBe(42)
    })

    it('ignoriert ungültige Retry-After-Werte', async () => {
      respondChat(
        { error: { message: 'x' } },
        { status: 429, headers: { 'Retry-After': 'Mon, 01 Jan 2030 00:00:00 GMT' } },
      )

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.retryAfterSeconds).toBeUndefined()
    })

    it('verwendet bei 500 ohne Message den Statuscode als Text', async () => {
      respondChat({ error: {} }, { status: 500 })

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.code).toBe('unknown')
      expect(error.message).toBe('HTTP 500')
    })

    it('verarbeitet Fehler mit Nicht-JSON-Body', async () => {
      server.use(
        http.post(CHAT_URL, () => new HttpResponse('<html>Bad Gateway</html>', { status: 502 })),
      )

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.code).toBe('modelUnavailable')
      expect(error.status).toBe(502)
      expect(error.message).toBe('HTTP 502')
    })

    it('meldet 200 mit Fehler im Body als AiError mit Statuscode', async () => {
      respondChat({ error: { code: 502, message: 'Modell gerade nicht verfügbar' } })

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.code).toBe('modelUnavailable')
      expect(error.status).toBe(502)
      expect(error.message).toBe('Modell gerade nicht verfügbar')
    })

    it('akzeptiert Fehlercodes als String im 200-Body', async () => {
      respondChat({ error: { code: '429', message: 'Limit' } })

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.code).toBe('rateLimited')
      expect(error.status).toBe(429)
    })

    it('meldet unbekannten Fehlercode im 200-Body als unknown ohne Status', async () => {
      respondChat({ error: { code: 'xyz' } })

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.code).toBe('unknown')
      expect(error.status).toBeUndefined()
      expect(error.message).toBe('Unbekannter Fehler')
    })

    it('meldet fehlende choices als invalidResponse', async () => {
      respondChat({ model: MODEL, choices: [] })

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.code).toBe('invalidResponse')
    })

    it('meldet einen Body ohne Modellfeld als invalidResponse', async () => {
      respondChat({ choices: [{ message: { content: 'x' } }] })

      await expect(errorOf(createProvider().complete({ messages }))).resolves.toMatchObject({
        code: 'invalidResponse',
      })
    })

    it('meldet einen Netzwerkfehler als network', async () => {
      server.use(http.post(CHAT_URL, () => HttpResponse.error()))

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.code).toBe('network')
      expect(error.cause).toBeInstanceOf(TypeError)
    })

    it('meldet eine Zeitüberschreitung als timeout', async () => {
      server.use(
        http.post(CHAT_URL, async () => {
          await delay(500)
          return HttpResponse.json(completionFixture('zu spät'))
        }),
      )

      const error = await errorOf(createProvider({ timeoutMs: 50 }).complete({ messages }))

      expect(error.code).toBe('timeout')
    })

    it('meldet einen Abbruch durch den Nutzer als aborted', async () => {
      server.use(
        http.post(CHAT_URL, async () => {
          await delay(500)
          return HttpResponse.json(completionFixture('zu spät'))
        }),
      )
      const controller = new AbortController()
      const pending = createProvider().complete({ messages, signal: controller.signal })
      setTimeout(() => controller.abort(), 10)

      const error = await errorOf(pending)

      expect(error.code).toBe('aborted')
    })

    // Bekannter Fehler im Quelltext: ein 200 mit Nicht-JSON-Body wird als `unknown` statt
    // `invalidResponse` gemeldet. `it.fails` hält das fest; nach dem Fix auf `it` umstellen.
    it('meldet einen Nicht-JSON-Body mit Status 200 als invalidResponse', async () => {
      server.use(http.post(CHAT_URL, () => new HttpResponse('kein JSON', { status: 200 })))

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.code).toBe('invalidResponse')
    })

    it('meldet einen unerwarteten Fehler als unknown', async () => {
      server.use(
        http.post(CHAT_URL, () => {
          throw new RangeError('kaputt')
        }),
      )

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.code).toBe('unknown')
    })
  })

  describe('AiError.retryable', () => {
    it.each([
      ['rateLimited', true],
      ['timeout', true],
      ['network', true],
      ['modelUnavailable', true],
      ['invalidKey', false],
      ['badRequest', false],
      ['aborted', false],
    ] as const)('ist für %s %s', (code, retryable) => {
      expect(new AiError(code, 'x').retryable).toBe(retryable)
    })

    it('wird aus einer echten Fehlerantwort übernommen', async () => {
      respondChat({ error: { message: 'x' } }, { status: 401 })

      const error = await errorOf(createProvider().complete({ messages }))

      expect(error.retryable).toBe(false)
    })
  })

  describe('stream', () => {
    it('streamt Textstücke, ignoriert Kommentare und liefert das Gesamtergebnis', async () => {
      respondStream(STREAM_PAYLOAD)
      const deltas: string[] = []

      const result = await createProvider().stream({ messages }, (delta) => deltas.push(delta))

      expect(deltas).toEqual(['Hal', 'lo', ' Welt'])
      expect(result).toEqual({
        text: 'Hallo Welt',
        model: MODEL,
        usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20, cost: 0.0001 },
      })
    })

    it('sendet stream: true im Body', async () => {
      let body: Record<string, unknown> | undefined
      server.use(
        http.post(CHAT_URL, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>
          return new HttpResponse('data: [DONE]\n\n', {
            headers: { 'Content-Type': 'text/event-stream' },
          })
        }),
      )

      await createProvider().stream({ messages, temperature: 1 }, () => undefined)

      expect(body).toMatchObject({ stream: true, model: MODEL, temperature: 1 })
    })

    it('verarbeitet Chunks, die an beliebigen Bytegrenzen zerschnitten sind', async () => {
      respondStream(STREAM_PAYLOAD, 7)
      const deltas: string[] = []

      const result = await createProvider().stream({ messages }, (delta) => deltas.push(delta))

      expect(result.text).toBe('Hallo Welt')
      expect(deltas.join('')).toBe('Hallo Welt')
    })

    it('verarbeitet CRLF-Zeilenenden', async () => {
      respondStream(STREAM_PAYLOAD.replace(/\n/g, '\r\n'))

      const result = await createProvider().stream({ messages }, () => undefined)

      expect(result.text).toBe('Hallo Welt')
    })

    it('verwendet das Modell aus dem Stream und ignoriert leere Deltas', async () => {
      respondStream(
        [
          `data: ${JSON.stringify({ model: 'other/model', choices: [{ delta: { content: null } }] })}`,
          `data: ${JSON.stringify({ choices: [{}] })}`,
          `data: ${JSON.stringify({ choices: [{ delta: { content: 'A' } }] })}`,
          'data: [DONE]',
          '',
        ].join('\n'),
      )
      const deltas: string[] = []

      const result = await createProvider().stream({ messages }, (delta) => deltas.push(delta))

      expect(result.model).toBe('other/model')
      expect(result.text).toBe('A')
      expect(result.usage).toBeUndefined()
      expect(deltas).toEqual(['A'])
    })

    it('überspringt Datenzeilen, die nicht dem Chunk-Format entsprechen', async () => {
      respondStream(`data: 42\n\ndata: null\n\n${modelChunk('ok')}data: [DONE]\n\n`)

      const result = await createProvider().stream({ messages }, () => undefined)

      expect(result.text).toBe('ok')
    })

    it('übernimmt Nutzung aus einem späteren Chunk ohne Usage-Feld nicht', async () => {
      respondStream(usageChunk + `data: ${JSON.stringify({ choices: [] })}\n\ndata: [DONE]\n\n`)

      const result = await createProvider().stream({ messages }, () => undefined)

      expect(result.usage?.totalTokens).toBe(20)
    })

    it('meldet einen Fehler mitten im Stream als AiError', async () => {
      respondStream(
        modelChunk('Teil') +
          `data: ${JSON.stringify({
            error: { code: 429, message: 'Rate limit erreicht' },
            choices: [{ finish_reason: 'error' }],
          })}\n\n`,
      )
      const deltas: string[] = []

      const error = await errorOf(
        createProvider().stream({ messages }, (delta) => deltas.push(delta)),
      )

      expect(error.code).toBe('rateLimited')
      expect(error.message).toBe('Rate limit erreicht')
      expect(deltas).toEqual(['Teil'])
    })

    it('meldet einen Fehler im Stream ohne Code als unknown', async () => {
      respondStream(`data: ${JSON.stringify({ error: { message: 'Kaputt' } })}\n\n`)

      const error = await errorOf(createProvider().stream({ messages }, () => undefined))

      expect(error.code).toBe('unknown')
      expect(error.message).toBe('Kaputt')
    })

    it('meldet eine ungültige JSON-Datenzeile als invalidResponse', async () => {
      respondStream(modelChunk('a') + 'data: {kaputt\n\n')

      const error = await errorOf(createProvider().stream({ messages }, () => undefined))

      expect(error.code).toBe('invalidResponse')
      expect(error.cause).toBeInstanceOf(SyntaxError)
    })

    it('meldet eine Antwort ohne Body als invalidResponse', async () => {
      server.use(http.post(CHAT_URL, () => new HttpResponse(null, { status: 200 })))

      const error = await errorOf(createProvider().stream({ messages }, () => undefined))

      expect(error.code).toBe('invalidResponse')
    })

    it('meldet HTTP-Fehler vor dem Stream', async () => {
      respondChat({ error: { message: 'Guthaben aufgebraucht' } }, { status: 402 })

      const error = await errorOf(createProvider().stream({ messages }, () => undefined))

      expect(error.code).toBe('insufficientCredits')
    })

    it('meldet einen Netzwerkfehler als network', async () => {
      server.use(http.post(CHAT_URL, () => HttpResponse.error()))

      const error = await errorOf(createProvider().stream({ messages }, () => undefined))

      expect(error.code).toBe('network')
    })
  })
})

describe('verifyOpenRouterKey', () => {
  it('liefert die Key-Informationen', async () => {
    await expect(verifyOpenRouterKey(VALID_TEST_KEY)).resolves.toEqual({
      label: 'sk-or-v1-tes...',
      limitRemaining: null,
      usage: 1.25,
      isFreeTier: false,
    })
  })

  it('trimmt den Key vor der Prüfung', async () => {
    await expect(verifyOpenRouterKey(`  ${VALID_TEST_KEY}\n`)).resolves.toMatchObject({
      usage: keyFixture.data.usage,
    })
  })

  it('übernimmt Limit und Gratis-Status', async () => {
    server.use(
      http.get(KEY_URL, () =>
        HttpResponse.json({
          data: { label: 'k', limit: 10, limit_remaining: 3.5, usage: 6.5, is_free_tier: true },
        }),
      ),
    )

    await expect(verifyOpenRouterKey(VALID_TEST_KEY)).resolves.toEqual({
      label: 'k',
      limitRemaining: 3.5,
      usage: 6.5,
      isFreeTier: true,
    })
  })

  it('setzt Standardwerte bei fehlenden optionalen Feldern', async () => {
    server.use(http.get(KEY_URL, () => HttpResponse.json({ data: {} })))

    await expect(verifyOpenRouterKey(VALID_TEST_KEY)).resolves.toEqual({
      label: '',
      limitRemaining: null,
      usage: 0,
      isFreeTier: false,
    })
  })

  it('meldet einen ungültigen Key als invalidKey', async () => {
    const error = await errorOf(verifyOpenRouterKey('sk-or-v1-falsch'))

    expect(error.code).toBe('invalidKey')
    expect(error.status).toBe(401)
  })

  it('meldet einen leeren Key als missingKey ohne Anfrage', async () => {
    let called = false
    server.use(
      http.get(KEY_URL, () => {
        called = true
        return HttpResponse.json(keyFixture)
      }),
    )

    const error = await errorOf(verifyOpenRouterKey('   '))

    expect(error.code).toBe('missingKey')
    expect(called).toBe(false)
  })

  it('meldet ein unerwartetes Format als invalidResponse', async () => {
    server.use(http.get(KEY_URL, () => HttpResponse.json({ data: 'kaputt' })))

    const error = await errorOf(verifyOpenRouterKey(VALID_TEST_KEY))

    expect(error.code).toBe('invalidResponse')
  })

  it('übergibt Zeitlimit und Abbruchsignal', async () => {
    server.use(
      http.get(KEY_URL, async () => {
        await delay(500)
        return HttpResponse.json(keyFixture)
      }),
    )

    const error = await errorOf(verifyOpenRouterKey(VALID_TEST_KEY, { timeoutMs: 30 }))

    expect(error.code).toBe('timeout')
  })

  it('nutzt eine eigene Basis-URL und einen eigenen fetch', async () => {
    const fetchSpy = vi.fn(async () => Response.json(keyFixture))

    await verifyOpenRouterKey(VALID_TEST_KEY, {
      baseUrl: 'https://proxy.example/api',
      fetch: fetchSpy as unknown as typeof fetch,
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://proxy.example/api/key',
      expect.objectContaining({ headers: { Authorization: `Bearer ${VALID_TEST_KEY}` } }),
    )
  })
})

describe('listOpenRouterModels', () => {
  it('lädt die Modelle ohne Authorization-Header', async () => {
    let authorization: string | null | undefined
    server.use(
      http.get(MODELS_URL, ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json(modelsFixture)
      }),
    )

    await listOpenRouterModels()

    expect(authorization).toBeNull()
  })

  it('mappt Modelle, rechnet Preise pro Million um und sortiert nach Name', async () => {
    const models = await listOpenRouterModels()

    expect(models).toEqual([
      {
        id: 'anthropic/claude-haiku-5.5',
        name: 'Anthropic: Claude Haiku 5.5',
        contextLength: 200_000,
        promptPricePerMillion: 0.1,
        completionPricePerMillion: 0.5,
        supportsStructuredOutputs: true,
      },
      {
        id: 'anthropic/claude-sonnet-5.5',
        name: 'Anthropic: Claude Sonnet 5.5',
        contextLength: 1_000_000,
        promptPricePerMillion: 2,
        completionPricePerMillion: 10,
        supportsStructuredOutputs: true,
      },
      {
        id: 'example/plain-model',
        name: 'Example: Plain Model',
        contextLength: 8_000,
        promptPricePerMillion: 0,
        completionPricePerMillion: 0,
        supportsStructuredOutputs: false,
      },
    ])
  })

  it('erkennt strukturierte Ausgaben auch am Parameter response_format', async () => {
    server.use(
      http.get(MODELS_URL, () =>
        HttpResponse.json({
          data: [{ id: 'a/b', supported_parameters: ['response_format'] }],
        }),
      ),
    )

    const [model] = await listOpenRouterModels()

    expect(model?.supportsStructuredOutputs).toBe(true)
  })

  it('übernimmt numerische Preise', async () => {
    server.use(
      http.get(MODELS_URL, () =>
        HttpResponse.json({
          data: [{ id: 'a/b', pricing: { prompt: 0.000003, completion: 0.000015 } }],
        }),
      ),
    )

    const [model] = await listOpenRouterModels()

    expect(model).toMatchObject({ promptPricePerMillion: 3, completionPricePerMillion: 15 })
  })

  it('liefert null für fehlende, negative oder unlesbare Preise', async () => {
    server.use(
      http.get(MODELS_URL, () =>
        HttpResponse.json({
          data: [
            { id: 'fehlt' },
            { id: 'negativ', pricing: { prompt: '-1', completion: '-0.5' } },
            { id: 'text', pricing: { prompt: 'gratis', completion: 'teuer' } },
          ],
        }),
      ),
    )

    const models = await listOpenRouterModels()

    expect(models.map((model) => model.promptPricePerMillion)).toEqual([null, null, null])
    expect(models.map((model) => model.completionPricePerMillion)).toEqual([null, null, null])
  })

  it('nimmt die ID als Namen und null als Kontextlänge, wenn Angaben fehlen', async () => {
    server.use(http.get(MODELS_URL, () => HttpResponse.json({ data: [{ id: 'x/y' }] })))

    await expect(listOpenRouterModels()).resolves.toEqual([
      {
        id: 'x/y',
        name: 'x/y',
        contextLength: null,
        promptPricePerMillion: null,
        completionPricePerMillion: null,
        supportsStructuredOutputs: false,
      },
    ])
  })

  it('meldet ein unerwartetes Format als invalidResponse', async () => {
    server.use(http.get(MODELS_URL, () => HttpResponse.json({ models: [] })))

    const error = await errorOf(listOpenRouterModels())

    expect(error.code).toBe('invalidResponse')
  })

  it('meldet HTTP-Fehler der Modellliste', async () => {
    server.use(
      http.get(MODELS_URL, () =>
        HttpResponse.json({ error: { message: 'Down' } }, { status: 503 }),
      ),
    )

    const error = await errorOf(listOpenRouterModels())

    expect(error.code).toBe('modelUnavailable')
  })

  it('meldet einen Netzwerkfehler als network', async () => {
    server.use(http.get(MODELS_URL, () => HttpResponse.error()))

    await expect(errorOf(listOpenRouterModels())).resolves.toMatchObject({ code: 'network' })
  })
})
