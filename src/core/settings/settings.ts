import { z } from 'zod'
import { DEFAULT_MODEL } from '@/core/ai'
import { TRASH_RETENTION_DAYS } from '@/core/blueprint/library'

export const settingsSchema = z.object({
  /** OpenRouter-API-Key. Liegt nur lokal im Browser des Nutzers. */
  apiKey: z.string().nullable(),
  model: z.string().min(1),
  /** Kreativität der Antworten (0 = vorhersehbar, 2 = sehr frei). */
  temperature: z.number().min(0).max(2),
  /** Sprache, in der die KI antwortet. */
  outputLanguage: z.enum(['de', 'en']),
  /** Sprache der Oberfläche und der exportierten Dateien. */
  uiLanguage: z.enum(['de', 'en']),
  /** Farbschema: dem System folgen oder fest hell/dunkel. */
  theme: z.enum(['system', 'light', 'dark']),
  /** Wie viele Tage Einträge im Papierkorb bleiben, bevor sie endgültig gelöscht werden. */
  trashRetentionDays: z.union(TRASH_RETENTION_DAYS.map((days) => z.literal(days))),
})
export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  apiKey: null,
  model: DEFAULT_MODEL,
  temperature: 0.7,
  outputLanguage: 'de',
  uiLanguage: 'de',
  theme: 'system',
  trashRetentionDays: 1,
}

export const SETTINGS_STORAGE_KEY = 'blueprint-wizard:settings'

/** Minimaler Ausschnitt der Web-Storage-API, damit Tests einen eigenen Speicher übergeben können. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * Lädt und speichert Einstellungen in `localStorage`. Unlesbare oder teilweise ungültige Daten
 * führen nie zu einem Fehler: ungültige Felder fallen auf ihren Standardwert zurück.
 */
export class SettingsStore {
  private readonly storage: KeyValueStorage

  constructor(storage: KeyValueStorage) {
    this.storage = storage
  }

  load(): Settings {
    let raw: unknown
    try {
      raw = JSON.parse(this.storage.getItem(SETTINGS_STORAGE_KEY) ?? 'null')
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
    if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS }

    const settings = { ...DEFAULT_SETTINGS }
    const shape = settingsSchema.shape
    for (const key of Object.keys(shape) as (keyof Settings)[]) {
      const field = shape[key].safeParse((raw as Record<string, unknown>)[key])
      if (field.success) Object.assign(settings, { [key]: field.data })
    }
    if (settings.apiKey !== null && !settings.apiKey.trim()) settings.apiKey = null
    return settings
  }

  save(settings: Settings): Settings {
    const valid = settingsSchema.parse({
      ...settings,
      apiKey: settings.apiKey?.trim() ? settings.apiKey.trim() : null,
    })
    this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(valid))
    return valid
  }

  update(patch: Partial<Settings>): Settings {
    return this.save({ ...this.load(), ...patch })
  }

  clearApiKey(): Settings {
    return this.update({ apiKey: null })
  }
}

export function hasApiKey(settings: Settings): boolean {
  return settings.apiKey !== null && settings.apiKey.trim().length > 0
}

export type ThemePreference = Settings['theme']

/** Das tatsächlich anzuzeigende Farbschema. */
export function resolveTheme(theme: ThemePreference, systemPrefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light'
  return theme
}
