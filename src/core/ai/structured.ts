import { z } from 'zod'
import { AiError } from './errors'
import type { AiProvider, ChatMessage, CompletionResult, JsonSchemaFormat } from './types'

export interface StructuredRequest<T> {
  provider: AiProvider
  /**
   * Schema der erwarteten Antwort. Für den Strict-Modus der Anbieter gilt: alle Felder sind Pflicht,
   * „kann fehlen“ wird als `.nullable()` ausgedrückt, nicht als `.optional()`.
   */
  schema: z.ZodType<T>
  /** Kurzer, technischer Name des Schemas, z. B. `blueprint_analysis`. */
  name: string
  messages: ChatMessage[]
  temperature?: number
  signal?: AbortSignal
}

export interface StructuredResult<T> {
  data: T
  /** Alle KI-Aufrufe dieses Vorgangs (1 oder 2 bei Reparaturversuch), z. B. für die Kostenanzeige. */
  calls: CompletionResult[]
}

export function toJsonSchemaFormat(name: string, schema: z.ZodType): JsonSchemaFormat {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>
  return { name, schema: jsonSchema }
}

/** Holt JSON aus einer Modellantwort, auch wenn es in einen ```json-Block gepackt wurde. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const candidate = (fenced?.[1] ?? text).trim()
  return JSON.parse(candidate)
}

type ParseOutcome<T> = { ok: true; data: T } | { ok: false; problem: string }

function parseAnswer<T>(text: string, schema: z.ZodType<T>): ParseOutcome<T> {
  let json: unknown
  try {
    json = extractJson(text)
  } catch {
    return { ok: false, problem: 'Die Antwort war kein gültiges JSON.' }
  }
  const result = schema.safeParse(json)
  if (result.success) return { ok: true, data: result.data }
  return { ok: false, problem: z.prettifyError(result.error) }
}

/**
 * Fragt eine JSON-Antwort nach Schema an und validiert sie. Ist die Antwort ungültig, wird das Modell
 * genau einmal mit der Fehlerbeschreibung um eine korrigierte Antwort gebeten.
 */
export async function generateStructured<T>({
  provider,
  schema,
  name,
  messages,
  temperature,
  signal,
}: StructuredRequest<T>): Promise<StructuredResult<T>> {
  const jsonSchema = toJsonSchemaFormat(name, schema)
  const calls: CompletionResult[] = []

  const first = await provider.complete({ messages, temperature, jsonSchema, signal })
  calls.push(first)
  const firstOutcome = parseAnswer(first.text, schema)
  if (firstOutcome.ok) return { data: firstOutcome.data, calls }

  const repairMessages: ChatMessage[] = [
    ...messages,
    { role: 'assistant', content: first.text },
    {
      role: 'user',
      content:
        `Deine Antwort passt nicht zum geforderten JSON-Schema:\n${firstOutcome.problem}\n` +
        'Antworte erneut, ausschließlich mit gültigem JSON nach dem Schema, ohne weiteren Text.',
    },
  ]
  const second = await provider.complete({
    messages: repairMessages,
    temperature,
    jsonSchema,
    signal,
  })
  calls.push(second)
  const secondOutcome = parseAnswer(second.text, schema)
  if (secondOutcome.ok) return { data: secondOutcome.data, calls }

  throw new AiError('invalidResponse', `Ungültige KI-Antwort für ${name}: ${secondOutcome.problem}`)
}
