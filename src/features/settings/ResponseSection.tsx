import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/app/useSettings'
import { formatDecimal } from '@/shared/lib/format'
import { Select } from '@/shared/ui/select'
import { SettingsSection } from './SettingsSection'

/** Rundet auf eine Nachkommastelle, damit der Schieberegler keine Rundungsreste speichert. */
function toTenth(value: number): number {
  return Math.round(value * 10) / 10
}

/** Temperatur und Sprache der KI-Antworten. Beide Werte werden sofort gespeichert. */
export function ResponseSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const temperatureId = useId()
  const hintId = useId()
  const languageId = useId()
  const [saved, setSaved] = useState(false)

  function handleTemperature(value: string) {
    update({ temperature: toTenth(Number(value)) })
    setSaved(true)
  }

  function handleLanguage(value: string) {
    if (value !== 'de' && value !== 'en') return
    update({ outputLanguage: value })
    setSaved(true)
  }

  return (
    <SettingsSection title={t('settings.response.title')}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={temperatureId} className="text-sm font-medium">
            {t('settings.response.temperatureLabel')}
          </label>
          <output htmlFor={temperatureId} className="font-mono text-sm tabular-nums">
            {formatDecimal(settings.temperature)}
          </output>
        </div>
        <input
          id={temperatureId}
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={settings.temperature}
          onChange={(event) => handleTemperature(event.target.value)}
          aria-describedby={hintId}
          className="w-full accent-primary"
        />
        <p id={hintId} className="text-xs text-muted-foreground">
          {t('settings.response.temperatureHint')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={languageId} className="block text-sm font-medium">
          {t('settings.response.languageLabel')}
        </label>
        <Select
          id={languageId}
          value={settings.outputLanguage}
          onChange={(event) => handleLanguage(event.target.value)}
          className="max-w-xs"
        >
          <option value="de">{t('settings.response.languages.de')}</option>
          <option value="en">{t('settings.response.languages.en')}</option>
        </Select>
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {saved && t('settings.saved')}
      </p>
    </SettingsSection>
  )
}
