import type { AiProvider, CompletionRequest, CompletionResult } from './types'

/** Ein KI-Aufruf mit Verbrauch, wie ihn die Kostenanzeige braucht. */
export interface UsageRecord {
  at: string
  model: string
  /** Name des Antwortschemas (z. B. `blueprint_analysis`), sonst `null`. */
  task: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** Kosten in US-Dollar laut Anbieter; `null`, wenn er keine meldet. */
  cost: number | null
}

export interface UsageSummary {
  calls: number
  totalTokens: number
  /** Summe der bekannten Kosten. */
  cost: number
  /** Mindestens ein Aufruf hatte keine Kostenangabe; die Summe ist dann eine Untergrenze. */
  costIncomplete: boolean
}

/** Höchstzahl gespeicherter Aufrufe; ältere fallen heraus, die Summe soll eine Sitzung abbilden. */
export const MAX_USAGE_RECORDS = 200

export function toUsageRecord(
  result: CompletionResult,
  request: CompletionRequest,
  now: Date,
): UsageRecord {
  const usage = result.usage
  return {
    at: now.toISOString(),
    model: result.model,
    task: request.jsonSchema?.name ?? null,
    promptTokens: usage?.promptTokens ?? 0,
    completionTokens: usage?.completionTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
    cost: usage?.cost ?? null,
  }
}

export function summarizeUsage(records: readonly UsageRecord[]): UsageSummary {
  return records.reduce<UsageSummary>(
    (sum, r) => ({
      calls: sum.calls + 1,
      totalTokens: sum.totalTokens + r.totalTokens,
      cost: sum.cost + (r.cost ?? 0),
      costIncomplete: sum.costIncomplete || r.cost === null,
    }),
    { calls: 0, totalTokens: 0, cost: 0, costIncomplete: false },
  )
}

/** Hängt einen Aufruf an und begrenzt die Liste auf `MAX_USAGE_RECORDS`. */
export function appendUsage(records: readonly UsageRecord[], record: UsageRecord): UsageRecord[] {
  return [...records, record].slice(-MAX_USAGE_RECORDS)
}

/**
 * Meldet nach jedem erfolgreichen Aufruf den Verbrauch, ohne das Verhalten des Anbieters zu ändern.
 * Fehlgeschlagene Aufrufe kosten bei OpenRouter in der Regel nichts und werden nicht gezählt.
 */
export class UsageTrackingProvider implements AiProvider {
  private readonly inner: AiProvider
  private readonly onUsage: (record: UsageRecord) => void
  private readonly now: () => Date

  constructor(
    inner: AiProvider,
    onUsage: (record: UsageRecord) => void,
    now: () => Date = () => new Date(),
  ) {
    this.inner = inner
    this.onUsage = onUsage
    this.now = now
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const result = await this.inner.complete(request)
    this.onUsage(toUsageRecord(result, request, this.now()))
    return result
  }

  async stream(
    request: CompletionRequest,
    onDelta: (delta: string) => void,
  ): Promise<CompletionResult> {
    const result = await this.inner.stream(request, onDelta)
    this.onUsage(toUsageRecord(result, request, this.now()))
    return result
  }
}
