import { LoaderCircle, Sparkles } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ADDITION_SECTION_IDS, type Addition, type AdditionSectionId } from '@/core/blueprint'
import type { AiTaskState } from '@/features/ai/useAiTask'
import { Button } from '@/shared/ui/button'

interface AdditionsPanelProps {
  openAdditions: Record<AdditionSectionId, Addition[]>
  acceptedCount: number
  rejectedCount: number
  state: AiTaskState
  hasAi: boolean
  onSuggest: () => void
  onCancel: () => void
  onAccept: (additionId: string) => void
  onReject: (additionId: string) => void
}

/** Vorschlagsmodus: die KI schlägt Ergänzungen vor, die einzeln angenommen oder abgelehnt werden. */
export function AdditionsPanel({
  openAdditions,
  acceptedCount,
  rejectedCount,
  state,
  hasAi,
  onSuggest,
  onCancel,
  onAccept,
  onReject,
}: AdditionsPanelProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const running = state.status === 'running'
  const groups = ADDITION_SECTION_IDS.filter((id) => openAdditions[id].length > 0)

  return (
    <section aria-labelledby={headingId} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={headingId} className="text-xl font-semibold">
            {t('decisions.additions.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('decisions.additions.intro')}</p>
        </div>
        {running ? (
          <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
              {t('decisions.additions.running')}
            </span>
            <Button variant="outline" size="sm" onClick={onCancel}>
              {t('decisions.additions.cancel')}
            </Button>
          </div>
        ) : (
          <Button size="sm" disabled={!hasAi} onClick={onSuggest}>
            <Sparkles className="size-4" aria-hidden />
            {t('decisions.additions.fetch')}
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

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('decisions.additions.empty')}</p>
      ) : (
        groups.map((sectionId) => (
          <AdditionGroup
            key={sectionId}
            sectionId={sectionId}
            additions={openAdditions[sectionId]}
            onAccept={onAccept}
            onReject={onReject}
          />
        ))
      )}

      {acceptedCount + rejectedCount > 0 && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          {t('decisions.additions.summary', { accepted: acceptedCount, rejected: rejectedCount })}
        </p>
      )}
    </section>
  )
}

interface AdditionGroupProps {
  sectionId: AdditionSectionId
  additions: readonly Addition[]
  onAccept: (additionId: string) => void
  onReject: (additionId: string) => void
}

function AdditionGroup({ sectionId, additions, onAccept, onReject }: AdditionGroupProps) {
  const { t } = useTranslation()
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="font-semibold">
        {t(`sections.${sectionId}`)}
      </h3>
      <ul className="space-y-2">
        {additions.map((addition) => (
          <li
            key={addition.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm break-words">{addition.text}</p>
              {addition.reason && (
                <p className="text-xs break-words text-muted-foreground">{addition.reason}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => onReject(addition.id)}>
                {t('decisions.additions.reject')}
              </Button>
              <Button size="sm" onClick={() => onAccept(addition.id)}>
                {t('decisions.additions.accept')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
