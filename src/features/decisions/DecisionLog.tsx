import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Decision } from '@/core/blueprint'
import { chosenOption } from '@/core/engine'
import { Button } from '@/shared/ui/button'
import { formatDate } from '@/shared/lib/format'

interface DecisionLogProps {
  /** Getroffene Entscheidungen in zeitlicher Reihenfolge. */
  decisions: readonly Decision[]
  /** Nur anzeigen, ohne „Wieder öffnen“. */
  readOnly?: boolean
  onReopen?: (decisionId: string) => void
}

/** Entscheidungsprotokoll: gewählte Option und Begründung je getroffener Entscheidung. */
export function DecisionLog({ decisions, readOnly = false, onReopen }: DecisionLogProps) {
  const { t } = useTranslation()
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="space-y-4 rounded-lg border bg-card p-4">
      <h2 id={headingId} className="text-xl font-semibold">
        {t('decisions.log.title')}
      </h2>

      {decisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('decisions.log.empty')}</p>
      ) : (
        <ol className="space-y-3">
          {decisions.map((decision) => {
            const chosen = chosenOption(decision)
            return (
              <li key={decision.id} className="space-y-1 border-t pt-3 first:border-t-0 first:pt-0">
                <p className="text-xs text-muted-foreground">
                  {t(`sections.${decision.sectionId}`)}
                  {decision.decidedAt && (
                    <>
                      {' · '}
                      <time dateTime={decision.decidedAt}>{formatDate(decision.decidedAt)}</time>
                    </>
                  )}
                </p>
                <h3 className="font-semibold break-words">{decision.title}</h3>
                {chosen && <p className="text-sm font-bold break-words">{chosen.label}</p>}
                <p
                  className={
                    decision.rationale.trim()
                      ? 'text-sm break-words whitespace-pre-wrap'
                      : 'text-sm text-muted-foreground italic'
                  }
                >
                  {decision.rationale.trim() || t('decisions.log.noRationale')}
                </p>
                {!readOnly && onReopen && (
                  <div className="pt-1">
                    <Button variant="outline" size="sm" onClick={() => onReopen(decision.id)}>
                      {t('decisions.log.reopen')}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
