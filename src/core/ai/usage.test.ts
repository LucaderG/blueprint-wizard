import { AiError } from './errors'
import { MockAiProvider } from './mockProvider'
import {
  appendUsage,
  MAX_USAGE_RECORDS,
  summarizeUsage,
  toUsageRecord,
  UsageTrackingProvider,
  type UsageRecord,
} from './usage'

const NOW = new Date('2026-10-11T10:00:00.000Z')

function record(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    at: NOW.toISOString(),
    model: 'm',
    task: null,
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
    cost: 0.001,
    ...overrides,
  }
}

describe('toUsageRecord', () => {
  it('übernimmt Tokens, Kosten, Modell und Schemaname', () => {
    expect(
      toUsageRecord(
        {
          text: '{}',
          model: 'anthropic/claude-haiku-5.5',
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, cost: 0.0004 },
        },
        { messages: [], jsonSchema: { name: 'blueprint_analysis', schema: {} } },
        NOW,
      ),
    ).toEqual({
      at: NOW.toISOString(),
      model: 'anthropic/claude-haiku-5.5',
      task: 'blueprint_analysis',
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
      cost: 0.0004,
    })
  })

  it('setzt fehlende Angaben auf 0 bzw. Kosten auf null', () => {
    expect(toUsageRecord({ text: '', model: 'm' }, { messages: [] }, NOW)).toMatchObject({
      task: null,
      totalTokens: 0,
      cost: null,
    })
  })
})

describe('summarizeUsage', () => {
  it('summiert Aufrufe, Tokens und Kosten', () => {
    expect(summarizeUsage([record(), record({ totalTokens: 5, cost: 0.002 })])).toEqual({
      calls: 2,
      totalTokens: 20,
      cost: 0.003,
      costIncomplete: false,
    })
  })

  it('markiert die Summe als unvollständig, wenn Kosten fehlen', () => {
    expect(summarizeUsage([record(), record({ cost: null })])).toMatchObject({
      cost: 0.001,
      costIncomplete: true,
    })
  })

  it('liefert für keine Aufrufe Nullen', () => {
    expect(summarizeUsage([])).toEqual({ calls: 0, totalTokens: 0, cost: 0, costIncomplete: false })
  })
})

describe('appendUsage', () => {
  it('begrenzt auf die neuesten Einträge', () => {
    const many = Array.from({ length: MAX_USAGE_RECORDS }, (_, i) => record({ at: `${i}` }))
    const next = appendUsage(many, record({ at: 'neu' }))
    expect(next).toHaveLength(MAX_USAGE_RECORDS)
    expect(next.at(-1)?.at).toBe('neu')
    expect(next[0]?.at).toBe('1')
  })
})

describe('UsageTrackingProvider', () => {
  it('meldet den Verbrauch nach complete und stream und reicht das Ergebnis durch', async () => {
    const seen: UsageRecord[] = []
    const provider = new UsageTrackingProvider(
      new MockAiProvider(['eins', 'zwei']),
      (r) => seen.push(r),
      () => NOW,
    )
    const first = await provider.complete({ messages: [{ role: 'user', content: 'a' }] })
    const deltas: string[] = []
    const second = await provider.stream({ messages: [{ role: 'user', content: 'b' }] }, (d) =>
      deltas.push(d),
    )
    expect(first.text).toBe('eins')
    expect(second.text).toBe('zwei')
    expect(deltas.join('')).toBe('zwei')
    expect(seen).toHaveLength(2)
    expect(seen[0]?.at).toBe(NOW.toISOString())
  })

  it('zählt fehlgeschlagene Aufrufe nicht', async () => {
    const seen: UsageRecord[] = []
    const provider = new UsageTrackingProvider(
      new MockAiProvider([new AiError('network', 'kaputt')]),
      (r) => seen.push(r),
    )
    await expect(provider.complete({ messages: [] })).rejects.toThrow()
    expect(seen).toHaveLength(0)
  })
})
