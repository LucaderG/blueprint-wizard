import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { IntegrationProposal } from '@/core/engine'
import { Button } from '@/shared/ui/button'
import type { IntegrationState, InterviewController } from './useInterview'

type IntegrationReviewProps = {
  integration: IntegrationState
} & Pick<
  InterviewController,
  | 'acceptProposal'
  | 'rejectProposal'
  | 'acceptAllProposals'
  | 'appendWithoutAi'
  | 'dismissIntegration'
  | 'cancel'
>

/** Einarbeiten der Antworten: Ladezustand, Vorschläge zum Prüfen oder Fehler mit Ausweg. */
export function IntegrationReview({ integration, ...actions }: IntegrationReviewProps) {
  const { t } = useTranslation()
  const titleId = useId()

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
      <section aria-labelledby={titleId} className="space-y-4">
        <div
          role="alert"
          className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-medium text-destructive">{t('interview.integration.errorIntro')}</p>
          <p className="text-destructive">{t(integration.errorKey)}</p>
          {integration.detail && (
            <p className="text-xs break-words opacity-80">{integration.detail}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={actions.appendWithoutAi}>
            {t('interview.integration.appendWithoutAi')}
          </Button>
          <Button variant="outline" onClick={actions.dismissIntegration}>
            {t('interview.integration.dismiss')}
          </Button>
        </div>
      </section>
    )
  }

  if (integration.status === 'review') {
    return (
      <section aria-labelledby={titleId} className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id={titleId} className="text-xl font-semibold">
              {t('interview.integration.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('interview.integration.intro')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={actions.acceptAllProposals}>
            {t('interview.integration.acceptAll')}
          </Button>
        </header>
        <ol className="space-y-3">
          {integration.proposals.map((proposal) => (
            <li key={proposal.sectionId}>
              <ProposalCard proposal={proposal} actions={actions} />
            </li>
          ))}
        </ol>
      </section>
    )
  }

  return null
}

interface ProposalCardProps {
  proposal: IntegrationProposal
  actions: Pick<InterviewController, 'acceptProposal' | 'rejectProposal'>
}

function ProposalCard({ proposal, actions }: ProposalCardProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const title = t(`sections.${proposal.sectionId}`)
  const hasBefore = proposal.before.trim() !== ''

  return (
    <article aria-labelledby={headingId} className="space-y-3 rounded-lg border bg-card p-4">
      <h3 id={headingId} className="font-semibold">
        {title}
      </h3>

      {proposal.shrinkWarning && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('interview.integration.shrinkWarning')}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground uppercase">
            {t('interview.integration.before')}
          </h4>
          <div className="rounded-md bg-muted p-3 text-sm break-words whitespace-pre-wrap">
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
          <div className="rounded-md border border-border p-3 text-sm break-words whitespace-pre-wrap">
            {proposal.after}
          </div>
        </div>
      </div>

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
    </article>
  )
}
