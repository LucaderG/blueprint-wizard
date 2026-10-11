import { useTranslation } from 'react-i18next'
import { ApiKeySection } from './ApiKeySection'
import { ModelSection } from './ModelSection'
import { ResponseSection } from './ResponseSection'

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
      <ApiKeySection />
      <ModelSection />
      <ResponseSection />
    </div>
  )
}
