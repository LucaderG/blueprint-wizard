import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useSettings } from '@/app/useSettings'
import { hasApiKey } from '@/core/settings'

/** Hinweis, solange noch kein OpenRouter-Key hinterlegt ist. Mit Key wird nichts angezeigt. */
export function ApiKeyNotice() {
  const { t } = useTranslation()
  const { settings } = useSettings()

  if (hasApiKey(settings)) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <p className="text-sm">{t('home.apiKeyNotice.text')}</p>
      <Link
        to="/einstellungen"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t('home.apiKeyNotice.link')}
      </Link>
    </div>
  )
}
