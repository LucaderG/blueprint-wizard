import { useTranslation } from 'react-i18next'
import { formatVersion } from '@/core/build/buildInfo'
import type { BuildInfo } from '@/core/build/buildInfo'

export function VersionFooter({ info = __BUILD_INFO__ }: { info?: BuildInfo }) {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-border">
      <p className="mx-auto max-w-5xl px-4 py-3 text-xs text-muted-foreground">
        {t('footer.version', { version: formatVersion(info) })}
      </p>
    </footer>
  )
}
