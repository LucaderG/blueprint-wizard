import { LoaderCircle, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AiTaskState } from '@/features/ai/useAiTask'
import { Button } from '@/shared/ui/button'

interface AiTaskControlsProps {
  state: AiTaskState
  hasAi: boolean
  label: string
  runningLabel: string
  onRun: () => void
  onCancel: () => void
}

/** Startknopf einer KI-Aufgabe mit Lade- und Abbruchzustand. */
export function AiTaskControls({
  state,
  hasAi,
  label,
  runningLabel,
  onRun,
  onCancel,
}: AiTaskControlsProps) {
  const { t } = useTranslation()
  if (state.status === 'running') {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
        <span className="flex items-center gap-2">
          <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
          {runningLabel}
        </span>
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t('monetization.cancel')}
        </Button>
      </div>
    )
  }
  return (
    <Button size="sm" disabled={!hasAi} onClick={onRun}>
      <Sparkles className="size-4" aria-hidden />
      {label}
    </Button>
  )
}

/** Fehlermeldung einer KI-Aufgabe; ohne Fehler wird nichts angezeigt. */
export function AiTaskError({ state }: { state: AiTaskState }) {
  const { t } = useTranslation()
  if (state.status !== 'error') return null
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
    >
      {t(state.errorKey)}
      {state.detail && (
        <span className="mt-1 block text-xs break-words opacity-80">{state.detail}</span>
      )}
    </p>
  )
}
