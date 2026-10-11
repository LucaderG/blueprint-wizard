import { createContext, useContext } from 'react'
import type { AiProvider } from '@/core/ai'
import type { Settings } from '@/core/settings'

export interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Settings>) => Settings
  clearApiKey: () => Settings
  /** KI-Anbieter für die aktuellen Einstellungen, `null` solange kein API-Key hinterlegt ist. */
  aiProvider: AiProvider | null
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

/** Einstellungen samt Änderungsfunktionen aus dem `SettingsProvider`. */
export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings braucht einen umschließenden SettingsProvider')
  return value
}

/** Der aktuelle KI-Anbieter oder `null`, wenn noch kein API-Key hinterlegt ist. */
export function useAiProvider(): AiProvider | null {
  return useSettings().aiProvider
}
