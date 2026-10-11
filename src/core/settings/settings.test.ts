import { MemoryStorage } from '@/test/memoryStorage'
import { DEFAULT_MODEL } from '@/core/ai'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SettingsStore,
  hasApiKey,
  type Settings,
} from './settings'

const custom: Settings = {
  apiKey: 'sk-or-v1-abc',
  model: 'openai/gpt-x',
  temperature: 1.2,
  outputLanguage: 'en',
}

function setup() {
  const storage = new MemoryStorage()
  return { storage, store: new SettingsStore(storage) }
}

describe('SettingsStore', () => {
  it('nutzt den erwarteten Speicherschlüssel', () => {
    const { storage, store } = setup()

    store.save(custom)

    expect(SETTINGS_STORAGE_KEY).toBe('blueprint-wizard:settings')
    expect(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? 'null')).toEqual(custom)
  })

  it('liefert die Standardwerte, wenn nichts gespeichert ist', () => {
    const { store } = setup()

    expect(store.load()).toEqual({
      apiKey: null,
      model: DEFAULT_MODEL,
      temperature: 0.7,
      outputLanguage: 'de',
    })
    expect(store.load()).toEqual(DEFAULT_SETTINGS)
  })

  it('speichert und lädt Einstellungen unverändert', () => {
    const { storage, store } = setup()
    store.save(custom)

    expect(new SettingsStore(storage).load()).toEqual(custom)
  })

  it('trimmt den API-Key beim Speichern', () => {
    const { store } = setup()

    expect(store.save({ ...custom, apiKey: '  sk-or-v1-abc \n' }).apiKey).toBe('sk-or-v1-abc')
  })

  it('speichert einen nur aus Leerzeichen bestehenden Key als null', () => {
    const { store } = setup()

    expect(store.save({ ...custom, apiKey: '   ' }).apiKey).toBeNull()
  })

  it('speichert einen fehlenden Key als null', () => {
    const { store } = setup()

    expect(store.save({ ...custom, apiKey: null }).apiKey).toBeNull()
  })

  it('fällt bei ungültigen Feldern einzeln auf den Standardwert zurück', () => {
    const { storage, store } = setup()
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ apiKey: 42, model: 'openai/gpt-x', temperature: 5, outputLanguage: 'fr' }),
    )

    expect(store.load()).toEqual({
      apiKey: null,
      model: 'openai/gpt-x',
      temperature: DEFAULT_SETTINGS.temperature,
      outputLanguage: DEFAULT_SETTINGS.outputLanguage,
    })
  })

  it('behält gültige Felder, auch wenn andere fehlen', () => {
    const { storage, store } = setup()
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ apiKey: 'sk-x', model: '' }))

    expect(store.load()).toEqual({ ...DEFAULT_SETTINGS, apiKey: 'sk-x' })
  })

  it.each(['{kaputt', 'nicht json', '{"apiKey":'])(
    'liefert Standardwerte bei defektem JSON %s',
    (raw) => {
      const { storage, store } = setup()
      storage.setItem(SETTINGS_STORAGE_KEY, raw)

      expect(store.load()).toEqual(DEFAULT_SETTINGS)
    },
  )

  it.each(['null', '42', '"text"', 'true'])(
    'liefert Standardwerte bei JSON ohne Objekt: %s',
    (raw) => {
      const { storage, store } = setup()
      storage.setItem(SETTINGS_STORAGE_KEY, raw)

      expect(store.load()).toEqual(DEFAULT_SETTINGS)
    },
  )

  it('liefert Standardwerte bei einem Array als Wurzel', () => {
    const { storage, store } = setup()
    storage.setItem(SETTINGS_STORAGE_KEY, '[1,2]')

    expect(store.load()).toEqual(DEFAULT_SETTINGS)
  })

  it('führt update mit bestehenden Einstellungen zusammen', () => {
    const { store } = setup()
    store.save(custom)

    const updated = store.update({ temperature: 0.1 })

    expect(updated).toEqual({ ...custom, temperature: 0.1 })
    expect(store.load()).toEqual(updated)
  })

  it('wirft bei update mit ungültigem Wert und speichert nichts', () => {
    const { storage, store } = setup()

    expect(() => store.update({ temperature: -1 })).toThrow()
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull()
  })

  it('entfernt nur den API-Key bei clearApiKey', () => {
    const { store } = setup()
    store.save(custom)

    expect(store.clearApiKey()).toEqual({ ...custom, apiKey: null })
    expect(store.load().model).toBe(custom.model)
  })

  it('lehnt eine ungültige Temperatur beim Speichern ab', () => {
    const { storage, store } = setup()

    expect(() => store.save({ ...custom, temperature: 5 })).toThrow()
    expect(() => store.save({ ...custom, temperature: -0.1 })).toThrow()
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull()
  })

  it('lehnt ein leeres Modell beim Speichern ab', () => {
    const { store } = setup()

    expect(() => store.save({ ...custom, model: '' })).toThrow()
  })

  it('akzeptiert die Grenzwerte der Temperatur', () => {
    const { store } = setup()

    expect(store.save({ ...custom, temperature: 0 }).temperature).toBe(0)
    expect(store.save({ ...custom, temperature: 2 }).temperature).toBe(2)
  })
})

describe('hasApiKey', () => {
  it.each([
    [null, false],
    ['', false],
    ['   ', false],
    ['sk-or-v1-abc', true],
  ])('ist für Key %j: %s', (apiKey, expected) => {
    expect(hasApiKey({ ...custom, apiKey })).toBe(expected)
  })
})

describe('SettingsStore – gespeicherter Key nur aus Leerzeichen', () => {
  it('lädt ihn als null', async () => {
    const { MemoryStorage } = await import('@/test/memoryStorage')
    const { SettingsStore, SETTINGS_STORAGE_KEY } = await import('./settings')
    const storage = new MemoryStorage()
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ apiKey: '   ' }))

    expect(new SettingsStore(storage).load().apiKey).toBeNull()
  })
})
