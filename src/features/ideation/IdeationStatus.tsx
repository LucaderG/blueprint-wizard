import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import type { IdeationController } from './useIdeation'

type IdeationStatusProps = Pick<
  IdeationController,
  'task' | 'activity' | 'nothingNew' | 'saveFailed' | 'retry' | 'cancel' | 'dismissError'
>

/** Ladezustand mit Abbrechen, Fehler mit „Erneut versuchen“ oder Hinweis auf ein leeres Ergebnis. */
export function IdeationStatus({
  task,
  activity,
  nothingNew,
  saveFailed,
  retry,
  cancel,
  dismissError,
}: IdeationStatusProps) {
  const { t } = useTranslation()

  if (activity !== null) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"
      >
        <span className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
          {t(`ideation.ideas.running.${activity}`)}
        </span>
        {activity !== 'choose' && (
          <Button variant="outline" size="sm" onClick={cancel}>
            {t('ideation.ideas.cancel')}
          </Button>
        )}
      </div>
    )
  }

  if (saveFailed) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
      >
        <p className="text-destructive">{t('projects.errors.generic')}</p>
        <Button size="sm" variant="ghost" onClick={dismissError}>
          {t('ideation.ideas.dismiss')}
        </Button>
      </div>
    )
  }

  if (task.status === 'error' || nothingNew) {
    return (
      <div
        role="alert"
        className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
      >
        {task.status === 'error' ? (
          <div className="space-y-1">
            <p className="font-medium text-destructive">{t('ideation.ideas.errorIntro')}</p>
            <p className="text-destructive">{t(task.errorKey)}</p>
            {task.detail && <p className="text-xs break-words opacity-80">{task.detail}</p>}
          </div>
        ) : (
          <p className="text-destructive">{t('ideation.ideas.nothingNew')}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void retry()}>
            {t('ideation.ideas.retry')}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissError}>
            {t('ideation.ideas.dismiss')}
          </Button>
        </div>
      </div>
    )
  }

  return null
}
