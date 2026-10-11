import { useTranslation } from 'react-i18next'
import type { Maturity } from '@/core/blueprint'
import { cn } from '@/shared/lib/utils'
import { MATURITY_DOT_CLASS } from './maturity'

interface MaturityBadgeProps {
  maturity: Maturity
}

/** Ampel-Anzeige des Reifegrads: Farbpunkt plus Text, damit die Farbe nicht allein trägt. */
export function MaturityBadge({ maturity }: MaturityBadgeProps) {
  const { t } = useTranslation()
  return (
    <span
      data-testid="maturity-badge"
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium"
    >
      <span aria-hidden className={cn('size-2.5 rounded-full', MATURITY_DOT_CLASS[maturity])} />
      {t(`maturity.${maturity}`)}
    </span>
  )
}
