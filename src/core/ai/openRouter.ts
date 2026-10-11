import { z } from 'zod'
import { AiError, aiErrorCodeForStatus } from './errors'
import { readSseData } from './sse'
import type {
  AiProvider,
  CompletionRequest,
  CompletionResult,
  KeyInfo,
  ModelInfo,
  TokenUsage,
} from './types'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys'
/** Standardmodell (Entscheidung Phase 2, siehe ADR 0003). In den Einstellungen frei änderbar. */
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-5.5'
export const DEFAULT_TIMEOUT_MS = 90_000

type FetchFn = typeof fetch

export interface OpenRouterOptions {
  apiKey: string
  model: string
  fetch?: FetchFn
  timeoutMs?: number
  baseUrl?: string
  /** Wird als `HTTP-Referer` gesendet; OpenRouter ordnet Aufrufe so der App zu. */
  appUrl?: string
  appTitle?: string
}

// --- Antwortformate (nur die Felder, die wir nutzen) -------------------------------------------

const errorBodySchema = z.object({
  error: z.object({
    code: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
  }),
})

const usageSchema = z
  .object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
    cost: z.number().optional(),
  })
  .optional()

const completionSchema = z.object({
  model: z.string(),
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: usageSchema,
})

const streamChunkSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(z.object({ delta: z.object({ content: z.string().nullish() }).optional() }))
    .optional(),
  usage: usageSchema.nullable(),
  error: z
    .object({ code: z.union([z.number(), z.string()]).optional(), message: z.string().optional() })
    .optional(),
})

const priceSchema = z.union([z.string(), z.number()]).optional()

const modelsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      context_length: z.number().nullish(),
      pricing: z.object({ prompt: priceSchema, completion: priceSchema }).partial().optional(),
      supported_parameters: z.array(z.string()).optional(),
    }),
  ),
})

const keySchema = z.object({
  data: z.object({
    label: z.string().nullish(),
    limit_remaining: z.number().nullish(),
    usage: z.number().nullish(),
    is_free_tier: z.boolean().nullish(),
  }),
})

// --- Hilfsfunktionen ---------------------------------------------------------------------------

function toUsage(raw: z.infer<typeof usageSchema> | null): TokenUsage | undefined {
  if (!raw) return undefined
  return {
    promptTokens: raw.prompt_tokens,
    completionTokens: raw.completion_tokens,
    totalTokens: raw.total_tokens,
    ...(raw.cost !== undefined && { cost: raw.cost }),
  }
}

function pricePerMillion(value: string | number | undefined): number | null {
  if (value === undefined) return null
  const perToken = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(perToken) || perToken < 0) return null
  return Math.round(perToken * 1_000_000 * 1e6) / 1e6
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('Retry-After')
  if (!header) return undefined
  const seconds = Number.parseInt(header, 10)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

function errorFromBody(code: number | string | undefined, message: string | undefined): AiError {
  const status = typeof code === 'number' ? code : Number.parseInt(code ?? '', 10)
  const known = Number.isFinite(status)
  return new AiError(
    known ? aiErrorCodeForStatus(status) : 'unknown',
    message ?? 'Unbekannter Fehler',
    {
      ...(known && { status }),
    },
  )
}

/** Liest einen JSON-Body; ein Body, der kein JSON ist, gilt als ungültige Antwort. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch (cause) {
    throw new AiError('invalidResponse', 'Antwort von OpenRouter ist kein JSON', { cause })
  }
}

async function errorFromResponse(response: Response): Promise<AiError> {
  let message = `HTTP ${response.status}`
  try {
    const parsed = errorBodySchema.safeParse(await response.json())
    if (parsed.success && parsed.data.error.message) message = parsed.data.error.message
  } catch {
    // Kein JSON-Body: Statuscode reicht.
  }
  return new AiError(aiErrorCodeForStatus(response.status), message, {
    status: response.status,
    retryAfterSeconds: parseRetryAfter(response),
  })
}

interface RequestContext {
  signal: AbortSignal
  timeoutSignal: AbortSignal
}

function createContext(timeoutMs: number, userSignal?: AbortSignal): RequestContext {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const signal = userSignal ? AbortSignal.any([userSignal, timeoutSignal]) : timeoutSignal
  return { signal, timeoutSignal }
}

/** Übersetzt Abbruch-, Timeout- und Netzwerkfehler in `AiError`; `AiError` bleibt unverändert. */
function normalizeError(error: unknown, context: RequestContext): AiError {
  if (error instanceof AiError) return error
  if (context.timeoutSignal.aborted) {
    return new AiError('timeout', 'Zeitüberschreitung bei der KI-Anfrage', { cause: error })
  }
  if (context.signal.aborted) return new AiError('aborted', 'Anfrage abgebrochen', { cause: error })
  if (error instanceof TypeError) {
    return new AiError('network', 'Netzwerkfehler bei der KI-Anfrage', { cause: error })
  }
  return new AiError('unknown', 'Unerwarteter Fehler bei der KI-Anfrage', { cause: error })
}

// --- Provider ----------------------------------------------------------------------------------

export class OpenRouterProvider implements AiProvider {
  private readonly options: Required<Omit<OpenRouterOptions, 'appUrl' | 'appTitle'>> &
    Pick<OpenRouterOptions, 'appUrl' | 'appTitle'>

  constructor(options: OpenRouterOptions) {
    if (!options.apiKey.trim())
      throw new AiError('missingKey', 'Kein OpenRouter-API-Key hinterlegt')
    this.options = {
      fetch: (...args) => globalThis.fetch(...args),
      timeoutMs: DEFAULT_TIMEOUT_MS,
      baseUrl: OPENROUTER_BASE_URL,
      ...options,
    }
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.options.apiKey.trim()}`,
      'Content-Type': 'application/json',
      ...(this.options.appUrl && { 'HTTP-Referer': this.options.appUrl }),
      ...(this.options.appTitle && { 'X-Title': this.options.appTitle }),
    }
  }

  private body(request: CompletionRequest, stream: boolean): string {
    return JSON.stringify({
      model: this.options.model,
      messages: request.messages,
      stream,
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.maxTokens !== undefined && { max_tokens: request.maxTokens }),
      ...(request.jsonSchema && {
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: request.jsonSchema.name,
            strict: true,
            schema: request.jsonSchema.schema,
          },
        },
        provider: { require_parameters: true },
      }),
    })
  }

  private async post(request: CompletionRequest, stream: boolean, context: RequestContext) {
    const response = await this.options.fetch(`${this.options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: this.body(request, stream),
      signal: context.signal,
    })
    if (!response.ok) throw await errorFromResponse(response)
    return response
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const context = createContext(this.options.timeoutMs, request.signal)
    try {
      const response = await this.post(request, false, context)
      const json = await readJson(response)

      // OpenRouter kann auch mit Status 200 einen Fehler im Body liefern.
      const errorBody = errorBodySchema.safeParse(json)
      if (errorBody.success)
        throw errorFromBody(errorBody.data.error.code, errorBody.data.error.message)

      const parsed = completionSchema.safeParse(json)
      if (!parsed.success) {
        throw new AiError('invalidResponse', 'Unerwartetes Antwortformat von OpenRouter', {
          cause: parsed.error,
        })
      }
      const [choice] = parsed.data.choices
      return {
        text: choice?.message.content ?? '',
        model: parsed.data.model,
        usage: toUsage(parsed.data.usage),
      }
    } catch (error) {
      throw normalizeError(error, context)
    }
  }

  async stream(
    request: CompletionRequest,
    onDelta: (delta: string) => void,
  ): Promise<CompletionResult> {
    const context = createContext(this.options.timeoutMs, request.signal)
    try {
      const response = await this.post(request, true, context)
      if (!response.body) throw new AiError('invalidResponse', 'Antwort ohne Inhalt')

      let text = ''
      let model = this.options.model
      let usage: TokenUsage | undefined
      for await (const data of readSseData(response.body)) {
        if (data === '[DONE]') break
        let raw: unknown
        try {
          raw = JSON.parse(data)
        } catch (cause) {
          throw new AiError('invalidResponse', 'Ungültiges Stream-Fragment', { cause })
        }
        const chunk = streamChunkSchema.safeParse(raw)
        if (!chunk.success) continue
        if (chunk.data.error) throw errorFromBody(chunk.data.error.code, chunk.data.error.message)
        if (chunk.data.model) model = chunk.data.model
        usage = toUsage(chunk.data.usage ?? null) ?? usage
        const delta = chunk.data.choices?.[0]?.delta?.content
        if (delta) {
          text += delta
          onDelta(delta)
        }
      }
      return { text, model, usage }
    } catch (error) {
      throw normalizeError(error, context)
    }
  }
}

// --- Kontoinformationen und Modellliste --------------------------------------------------------

export interface OpenRouterRequestOptions {
  fetch?: FetchFn
  baseUrl?: string
  timeoutMs?: number
  signal?: AbortSignal
}

async function getJson(path: string, apiKey: string | null, options: OpenRouterRequestOptions) {
  const { fetch: fetchFn = globalThis.fetch, baseUrl = OPENROUTER_BASE_URL } = options
  const context = createContext(options.timeoutMs ?? 30_000, options.signal)
  try {
    const response = await fetchFn(`${baseUrl}${path}`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey.trim()}` } : {},
      signal: context.signal,
    })
    if (!response.ok) throw await errorFromResponse(response)
    return await readJson(response)
  } catch (error) {
    throw normalizeError(error, context)
  }
}

/** Prüft einen API-Key („Verbindung testen“). Wirft `AiError` mit `invalidKey`, wenn er nicht gilt. */
export async function verifyOpenRouterKey(
  apiKey: string,
  options: OpenRouterRequestOptions = {},
): Promise<KeyInfo> {
  if (!apiKey.trim()) throw new AiError('missingKey', 'Kein OpenRouter-API-Key hinterlegt')
  const parsed = keySchema.safeParse(await getJson('/key', apiKey, options))
  if (!parsed.success) {
    throw new AiError('invalidResponse', 'Unerwartetes Antwortformat von OpenRouter', {
      cause: parsed.error,
    })
  }
  const { data } = parsed.data
  return {
    label: data.label ?? '',
    limitRemaining: data.limit_remaining ?? null,
    usage: data.usage ?? 0,
    isFreeTier: data.is_free_tier ?? false,
  }
}

/** Lädt die öffentliche Modellliste, alphabetisch nach Name sortiert. */
export async function listOpenRouterModels(
  options: OpenRouterRequestOptions = {},
): Promise<ModelInfo[]> {
  const parsed = modelsSchema.safeParse(await getJson('/models', null, options))
  if (!parsed.success) {
    throw new AiError('invalidResponse', 'Unerwartetes Format der Modellliste', {
      cause: parsed.error,
    })
  }
  return parsed.data.data
    .map((model) => {
      const parameters = model.supported_parameters ?? []
      return {
        id: model.id,
        name: model.name ?? model.id,
        contextLength: model.context_length ?? null,
        promptPricePerMillion: pricePerMillion(model.pricing?.prompt),
        completionPricePerMillion: pricePerMillion(model.pricing?.completion),
        supportsStructuredOutputs:
          parameters.includes('structured_outputs') || parameters.includes('response_format'),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
}
