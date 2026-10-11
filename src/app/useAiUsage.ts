import { createContext, useContext } from 'react'
import type { UsageRecord } from '@/core/ai'

export interface AiUsageContextValue {
  /** KI-Aufrufe dieser Sitzung, älteste zuerst. */
  records: readonly UsageRecord[]
  reset: () => void
}

export const AiUsageContext = createContext<AiUsageContextValue>({ records: [], reset: () => {} })

/** Verbrauch der KI-Aufrufe dieser Sitzung (für die Kostenanzeige). */
export function useAiUsage(): AiUsageContextValue {
  return useContext(AiUsageContext)
}
