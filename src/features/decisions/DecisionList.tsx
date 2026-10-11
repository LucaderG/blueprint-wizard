import { LoaderCircle, Sparkles } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { DecisionRanking } from '@/core/engine'
import type { AiTaskState } from '@/features/ai/useAiTask'
import { Button } from '@/shared/ui/button'
import { DecisionCard } from './DecisionCard'

interface DecisionListProps {
  ranking: DecisionRanking
  state: AiTaskState
  hasAi: boolean
  onIdentify: () => void
  onCancel: () => void
  onDecide: (decisionId: string, optionId: string, rationale: string) => void
  onDismiss: (decisionId: string) => void
}

/** „Wichtigste Entscheidungen“: Ermittlung starten, Rangliste und die weiteren Entscheidungen. */
export function DecisionList({
  ranking,
  state,
  hasAi,
  onIdentify,
  onCancel,
  onDecide,
  onDismiss,
}: DecisionListProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const running = state.status === 'running'
  const openCount = ranking.core.length + ranking.more.length
  const hasOpen = openCount > 0

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={headingId} className="text-xl font-semibold">
            {t('decisions.list.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('decisions.list.intro')}</p>
        </div>
        {running ? (
          <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
              {t('decisions.list.running')}
            </span>
            <Button variant="outline" size="sm" onClick={onCancel}>
              {t('decisions.list.cancel')}
            </Button>
          </div>
        ) : (
          <Button size="sm" disabled={!hasAi} onClick={onIdentify}>
            <Sparkles className="size-4" aria-hidden />
            {hasOpen ? t('decisions.list.rerun') : t('decisions.list.find')}
          </Button>
        )}
      </div>

      {state.status === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {t(state.errorKey)}
          {state.detail && (
            <span className="mt-1 block text-xs break-words opacity-80">{state.detail}</span>
          )}
        </p>
      )}

      {hasOpen ? (
        <>
          <ol className="space-y-4">
            {ranking.core.map((decision) => (
              <li key={decision.id}>
                <DecisionCard
                  decision={decision}
                  onDecide={(optionId, rationale) => onDecide(decision.id, optionId, rationale)}
                  onDismiss={() => onDismiss(decision.id)}
                />
              </li>
            ))}
          </ol>

          {ranking.more.length > 0 && (
            <details className="rounded-lg border bg-card p-4">
              <summary className="cursor-pointer font-semibold">
                {t('decisions.list.more', { count: ranking.more.length })}
              </summary>
              <ol start={ranking.core.length + 1} className="mt-4 space-y-4">
                {ranking.more.map((decision) => (
                  <li key={decision.id}>
                    <DecisionCard
                      decision={decision}
                      onDecide={(optionId, rationale) => onDecide(decision.id, optionId, rationale)}
                      onDismiss={() => onDismiss(decision.id)}
                    />
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {ranking.log.length > 0 ? t('decisions.list.emptyDone') : t('decisions.list.empty')}
        </p>
      )}
    </section>
  )
}
