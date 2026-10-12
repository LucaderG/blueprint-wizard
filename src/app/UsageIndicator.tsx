import { Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { summarizeUsage, type UsageRecord } from '@/core/ai'
import { formatNumber, formatUsd } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { useAiUsage } from './useAiUsage'

const KNOWN_TASKS = [
  'idea_classification',
  'blueprint_analysis',
  'answer_integration',
  'core_decisions',
  'blueprint_additions',
  'project_ideas',
  'project_variants',
  'profile_expansion',
] as const
type KnownTask = (typeof KNOWN_TASKS)[number]

const isKnownTask = (task: string | null): task is KnownTask =>
  (KNOWN_TASKS as readonly (string | null)[]).includes(task)

/**
 * Kostenanzeige im Kopf: Kosten der letzten KI-Anfrage und Summe dieser Sitzung. Erscheint erst nach
 * der ersten Anfrage.
 */
export function UsageIndicator() {
  const { t } = useTranslation()
  const { records, reset } = useAiUsage()
  const last = records.at(-1)
  if (!last) return null
  const total = summarizeUsage(records)
  const cost = (r: Pick<UsageRecord, 'cost'>) =>
    r.cost === null ? t('usage.costUnknown') : formatUsd(r.cost)

  return (
    <details className="relative">
      <summary
        aria-label={t('usage.summaryLabel', { cost: formatUsd(total.cost) })}
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-3 py-1.5 text-sm tabular-nums hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden"
      >
        <Coins className="size-4" aria-hidden />
        {total.costIncomplete ? '≥ ' : ''}
        {formatUsd(total.cost)}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-lg">
        <section className="space-y-1">
          <h2 className="font-semibold">{t('usage.lastTitle')}</h2>
          <p className="text-muted-foreground">
            {isKnownTask(last.task) ? t(`usage.tasks.${last.task}`) : t('usage.tasks.other')}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-muted-foreground">{t('usage.tokens')}</dt>
            <dd className="text-right whitespace-nowrap tabular-nums">
              {t('usage.tokensInOut', {
                input: formatNumber(last.promptTokens),
                output: formatNumber(last.completionTokens),
              })}
            </dd>
            <dt className="text-muted-foreground">{t('usage.cost')}</dt>
            <dd className="text-right tabular-nums">{cost(last)}</dd>
          </dl>
          <p className="truncate text-xs text-muted-foreground" title={last.model}>
            {last.model}
          </p>
        </section>
        <section className="space-y-1 border-t pt-3">
          <h2 className="font-semibold">{t('usage.sessionTitle')}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-muted-foreground">{t('usage.calls')}</dt>
            <dd className="text-right tabular-nums">{formatNumber(total.calls)}</dd>
            <dt className="text-muted-foreground">{t('usage.tokens')}</dt>
            <dd className="text-right tabular-nums">{formatNumber(total.totalTokens)}</dd>
            <dt className="text-muted-foreground">{t('usage.cost')}</dt>
            <dd className="text-right tabular-nums">
              {total.costIncomplete ? '≥ ' : ''}
              {formatUsd(total.cost)}
            </dd>
          </dl>
          {total.costIncomplete && (
            <p className="text-xs text-muted-foreground">{t('usage.incomplete')}</p>
          )}
        </section>
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">{t('usage.source')}</p>
          <Button size="sm" variant="ghost" onClick={reset}>
            {t('usage.reset')}
          </Button>
        </div>
      </div>
    </details>
  )
}
