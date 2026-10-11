import { CircleAlert, Check, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SaveState } from '@/features/projects/useProjectEditor'
import { Button } from '@/shared/ui/button'

interface SaveStatusProps {
  saveState: SaveState
  onRetry: () => void
}

/** Zeigt, ob die letzten Änderungen gespeichert sind; bei Fehlern mit Wiederholen-Knopf. */
export function SaveStatus({ saveState, onRetry }: SaveStatusProps) {
  const { t } = useTranslation()

  if (saveState === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        <span aria-live="polite">{t('blueprint.saveStatus.error')}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('blueprint.saveStatus.retry')}
        </Button>
      </div>
    )
  }

  const pending = saveState === 'pending' || saveState === 'saving'
  return (
    <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
      {pending ? (
        <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Check className="size-4 shrink-0" aria-hidden />
      )}
      {pending ? t('blueprint.saveStatus.pending') : t('blueprint.saveStatus.saved')}
    </p>
  )
}
