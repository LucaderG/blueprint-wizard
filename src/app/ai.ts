import { OpenRouterProvider, type AiProvider } from '@/core/ai'
import { SettingsStore, type Settings } from '@/core/settings'

export type AiProviderFactory = (settings: Settings) => AiProvider

/** OpenRouter mit dem hinterlegten Key und Modell. Nur aufrufen, wenn ein Key vorhanden ist. */
export const createDefaultAiProvider: AiProviderFactory = (settings) =>
  new OpenRouterProvider({
    apiKey: settings.apiKey ?? '',
    model: settings.model,
    appUrl: window.location.origin,
    appTitle: 'Blueprint-Wizard',
  })

/** Einstellungsspeicher der laufenden App (localStorage). */
export function createDefaultSettingsStore(): SettingsStore {
  return new SettingsStore(window.localStorage)
}
