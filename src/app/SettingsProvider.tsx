import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createDefaultAiProvider, type AiProviderFactory } from '@/app/ai'
import { SettingsContext, type SettingsContextValue } from '@/app/useSettings'
import { hasApiKey, type Settings, type SettingsStore } from '@/core/settings'

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

  const aiProvider = useMemo(
    () => (hasApiKey(settings) ? createAiProvider(settings) : null),
    [settings, createAiProvider],
  )

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, update, clearApiKey, aiProvider }),
    [settings, update, clearApiKey, aiProvider],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
