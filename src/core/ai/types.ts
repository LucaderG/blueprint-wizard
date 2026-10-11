export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

/** JSON-Schema, gegen das das Modell antworten soll (OpenRouter „structured outputs“). */
export interface JsonSchemaFormat {
  name: string
  schema: Record<string, unknown>
}

export interface CompletionRequest {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  /** Erzwingt eine JSON-Antwort nach diesem Schema. */
  jsonSchema?: JsonSchemaFormat
  signal?: AbortSignal
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** Kosten in US-Dollar, falls der Anbieter sie meldet. */
  cost?: number
}

export interface CompletionResult {
  text: string
  /** Das tatsächlich verwendete Modell (kann bei Routern vom angefragten abweichen). */
  model: string
  usage?: TokenUsage
}

export interface ModelInfo {
  id: string
  name: string
  contextLength: number | null
  /** Preis pro Million Eingabe-Tokens in US-Dollar, `null` wenn unbekannt. */
  promptPricePerMillion: number | null
  completionPricePerMillion: number | null
  supportsStructuredOutputs: boolean
}

export interface KeyInfo {
  label: string
  /** Verbleibendes Guthaben-Limit des Keys in US-Dollar, `null` = unbegrenzt. */
  limitRemaining: number | null
  usage: number
  isFreeTier: boolean
}

/**
 * Schnittstelle zu einem KI-Anbieter. Die App nutzt `OpenRouterProvider`,
 * Tests und Offline-Demos nutzen `MockAiProvider`.
 */
export interface AiProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>
  /** Streamt die Antwort; `onDelta` erhält jedes neue Textstück. Liefert am Ende das Gesamtergebnis. */
  stream(request: CompletionRequest, onDelta: (delta: string) => void): Promise<CompletionResult>
}
