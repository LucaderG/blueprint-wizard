import { CircleCheck, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { IntegrationProposal } from '@/core/engine'
import { Button } from '@/shared/ui/button'
import type { IntegrationState, InterviewController } from './useInterview'

type ChangesSummaryProps = {
  integration: IntegrationState
} & Pick<
  InterviewController,
  | 'revertApplied'
  | 'acceptProposal'
  | 'rejectProposal'
  | 'retryIntegration'
  | 'appendWithoutAi'
  | 'dismissIntegration'
  | 'cancel'
>

/**
 * Rückmeldung nach „Antworten übernehmen“: Ladezustand, kurze Zusammenfassung der übernommenen
 * Änderungen (aufklappbar, zurücknehmbar), stark kürzende Änderungen zur Bestätigung oder Fehler.
 */
export function ChangesSummary({ integration, ...actions }: ChangesSummaryProps) {
  const { t } = useTranslation()
  const reviewId = useId()

  if (integration.status === 'running') {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"
      >
        <span className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
          {t('interview.integration.running')}
        </span>
        <Button variant="outline" size="sm" onClick={actions.cancel}>
          {t('interview.integration.cancel')}
        </Button>
      </div>
    )
  }

  if (integration.status === 'error') {
    return (
      <div
        role="alert"
        className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
      >
        <div className="space-y-1">
          <p className="font-medium text-destructive">{t('interview.integration.errorIntro')}</p>
          <p className="text-destructive">{t(integration.errorKey)}</p>
          {integration.detail && (
            <p className="text-xs break-words opacity-80">{integration.detail}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void actions.retryIntegration()}>
            {t('interview.integration.retry')}
          </Button>
          <Button size="sm" variant="outline" onClick={actions.appendWithoutAi}>
            {t('interview.integration.appendWithoutAi')}
          </Button>
          <Button size="sm" variant="ghost" onClick={actions.dismissIntegration}>
            {t('interview.integration.dismiss')}
          </Button>
        </div>
      </div>
    )
  }

  if (integration.status !== 'done') return null
  const { applied, toReview } = integration
  const sectionNames = applied.map((p) => t(`sections.${p.sectionId}`)).join(', ')

  return (
    <div className="space-y-3">
      {applied.length > 0 && (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
          <div className="flex items-start gap-2">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p className="flex-1" role="status">
              {t('interview.integration.applied', {
                count: applied.length,
                sections: sectionNames,
              })}
            </p>
            <button
              type="button"
              onClick={actions.dismissIntegration}
              aria-label={t('interview.integration.dismiss')}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-6">
            <Button size="sm" variant="outline" onClick={actions.revertApplied}>
              {t('interview.integration.revert')}
            </Button>
            <details className="w-full">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                {t('interview.integration.showChanges')}
              </summary>
              <ol className="mt-3 space-y-3">
                {applied.map((proposal) => (
                  <li key={proposal.sectionId}>
                    <BeforeAfter proposal={proposal} />
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </div>
      )}

      {toReview.length > 0 && (
        <section aria-labelledby={reviewId} className="space-y-3">
          <h2
            id={reviewId}
            className="flex items-center gap-2 text-base font-semibold text-destructive"
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {t('interview.integration.reviewTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('interview.integration.shrinkWarning')}
          </p>
          <ol className="space-y-3">
            {toReview.map((proposal) => (
              <li key={proposal.sectionId} className="space-y-2">
                <BeforeAfter proposal={proposal} />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => actions.rejectProposal(proposal.sectionId)}
                  >
                    {t('interview.integration.reject')}
                  </Button>
                  <Button size="sm" onClick={() => actions.acceptProposal(proposal.sectionId)}>
                    {t('interview.integration.accept')}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function BeforeAfter({ proposal }: { proposal: IntegrationProposal }) {
  const { t } = useTranslation()
  const headingId = useId()
  const hasBefore = proposal.before.trim() !== ''

  return (
    <article aria-labelledby={headingId} className="space-y-2 rounded-lg border bg-card p-3">
      <h3 id={headingId} className="text-sm font-semibold">
        {t(`sections.${proposal.sectionId}`)}
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground uppercase">
            {t('interview.integration.before')}
          </h4>
          <div className="rounded-md bg-muted p-2 text-sm break-words whitespace-pre-wrap">
            {hasBefore ? (
              proposal.before
            ) : (
              <span className="text-muted-foreground italic">
                {t('interview.integration.emptyBefore')}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground uppercase">
            {t('interview.integration.after')}
          </h4>
          <div className="rounded-md border border-border p-2 text-sm break-words whitespace-pre-wrap">
            {proposal.after}
          </div>
        </div>
      </div>
    </article>
  )
}
