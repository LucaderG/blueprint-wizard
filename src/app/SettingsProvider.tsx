import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createDefaultAiProvider, type AiProviderFactory } from '@/app/ai'
import { useAppearance } from '@/app/useAppearance'
import { AiUsageContext, type AiUsageContextValue } from '@/app/useAiUsage'
import { appendUsage, UsageTrackingProvider, type UsageRecord } from '@/core/ai'
import { SettingsContext, type SettingsContextValue } from '@/app/useSettings'
import { hasApiKey, type Settings, type SettingsStore } from '@/core/settings'

/** Der Verbrauch gilt für die Sitzung im Tab und überlebt Neuladen, nicht das Schließen. */
export const USAGE_STORAGE_KEY = 'blueprint-wizard:usage'

function loadUsage(): UsageRecord[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(USAGE_STORAGE_KEY) ?? '[]')
    return Array.isArray(raw) ? (raw as UsageRecord[]).filter(isUsageRecord) : []
  } catch {
    return []
  }
}

function isUsageRecord(value: unknown): value is UsageRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.at === 'string' &&
    typeof r.model === 'string' &&
    typeof r.totalTokens === 'number' &&
    (r.cost === null || typeof r.cost === 'number')
  )
}

function storeUsage(records: readonly UsageRecord[]) {
  try {
    sessionStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Ohne Speicher zählt die Anzeige nur bis zum Neuladen.
  }
}

interface SettingsProviderProps {
  store: SettingsStore
  /** Erzeugt den KI-Anbieter aus den Einstellungen; Tests übergeben hier einen Mock. */
  createAiProvider?: AiProviderFactory
  children: ReactNode
}

/** Stellt Einstellungen und den daraus abgeleiteten KI-Anbieter für die ganze App bereit. */
export function SettingsProvider({
  store,
  createAiProvider = createDefaultAiProvider,
  children,
}: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(() => store.load())
  useAppearance(settings)

  const update = useCallback(
    (patch: Partial<Settings>) => {
      const saved = store.update(patch)
      setSettings(saved)
      return saved
    },
    [store],
  )

  const clearApiKey = useCallback(() => {
    const saved = store.clearApiKey()
    setSettings(saved)
    return saved
  }, [store])

  const [usage, setUsage] = useState<UsageRecord[]>(loadUsage)
  const record = useCallback((entry: UsageRecord) => {
    setUsage((current) => {
      const next = appendUsage(current, entry)
      storeUsage(next)
      return next
    })
  }, [])
  const resetUsage = useCallback(() => {
    storeUsage([])
    setUsage([])
  }, [])
  const usageValue = useMemo<AiUsageContextValue>(
    () => ({ records: usage, reset: resetUsage }),
    [usage, resetUsage],
  )

  // Jeder KI-Aufruf meldet seinen Verbrauch an die Kostenanzeige.
  const aiProvider = useMemo(
    () =>
      hasApiKey(settings) ? new UsageTrackingProvider(createAiProvider(settings), record) : null,
    [settings, createAiProvider, record],
  )

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, update, clearApiKey, aiProvider }),
    [settings, update, clearApiKey, aiProvider],
  )

  return (
    <SettingsContext.Provider value={value}>
      <AiUsageContext.Provider value={usageValue}>{children}</AiUsageContext.Provider>
    </SettingsContext.Provider>
  )
}
