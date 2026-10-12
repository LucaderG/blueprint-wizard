import { Monitor, Moon, Sun } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/app/useSettings'
import type { Settings } from '@/core/settings'
import { Select } from '@/shared/ui/select'
import { SettingsSection } from './SettingsSection'

const THEMES = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
] as const satisfies readonly { value: Settings['theme']; icon: unknown }[]

/** Sprache der Oberfläche und Farbschema; beides wirkt sofort. */
export function AppearanceSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const languageId = useId()
  const themeName = useId()

  function handleLanguage(value: string) {
    if (value === 'de' || value === 'en') update({ uiLanguage: value })
  }

  return (
    <SettingsSection
      title={t('settings.appearance.title')}
      description={t('settings.appearance.intro')}
    >
      <div className="space-y-1.5">
        <label htmlFor={languageId} className="block text-sm font-medium">
          {t('settings.appearance.languageLabel')}
        </label>
        <Select
          id={languageId}
          value={settings.uiLanguage}
          onChange={(event) => handleLanguage(event.target.value)}
          className="max-w-xs"
        >
          {/* Sprachnamen stehen bewusst in der eigenen Sprache, damit man sie immer findet. */}
          <option value="de" lang="de">
            Deutsch
          </option>
          <option value="en" lang="en">
            English
          </option>
        </Select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('settings.appearance.themeLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {THEMES.map(({ value, icon: Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name={themeName}
                value={value}
                checked={settings.theme === value}
                onChange={() => update({ theme: value })}
                className="sr-only"
              />
              <Icon className="size-4" aria-hidden />
              {t(`settings.appearance.themes.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
    </SettingsSection>
  )
}
