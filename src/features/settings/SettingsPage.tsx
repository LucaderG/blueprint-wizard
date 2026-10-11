import { useTranslation } from 'react-i18next'

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
      <p className="text-muted-foreground">{t('settings.placeholder')}</p>
    </div>
  )
}
