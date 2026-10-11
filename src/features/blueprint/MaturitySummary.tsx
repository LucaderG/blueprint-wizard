import { useTranslation } from 'react-i18next'
import type { Maturity } from '@/core/blueprint'
import { cn } from '@/shared/lib/utils'
import { MATURITY_DOT_CLASS, MATURITY_OPTIONS } from './maturity'

interface MaturitySummaryProps {
  counts: Record<Maturity, number>
}

/** Legende mit der Anzahl der Abschnitte je Reifegrad. */
export function MaturitySummary({ counts }: MaturitySummaryProps) {
  const { t } = useTranslation()
  return (
    <ul
      aria-label={t('blueprint.summary.label')}
      className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"
    >
      {MATURITY_OPTIONS.map((maturity) => (
        <li key={maturity} className="flex items-center gap-2">
          <span aria-hidden className={cn('size-2.5 rounded-full', MATURITY_DOT_CLASS[maturity])} />
          {t(`blueprint.summary.${maturity}`, { n: counts[maturity] })}
        </li>
      ))}
    </ul>
  )
}
