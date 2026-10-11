import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AiError } from '@/core/ai'
import { aiErrorDetail } from '@/features/settings/aiErrorDetail'
import { aiErrorKey, type AiErrorKey } from '@/features/settings/aiErrors'

export type AiTaskErrorKey = AiErrorKey | 'projects.errors.generic'

export type AiTaskState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'error'; errorKey: AiTaskErrorKey; detail: string | null }

export interface AiTask {
  state: AiTaskState
  /**
   * Führt eine abbrechbare KI-Anfrage aus. `task` bekommt das Abbruchsignal; `onSuccess` läuft nur,
   * wenn nicht abgebrochen wurde. Eine laufende Anfrage dieser Aufgabe wird vorher abgebrochen.
   */
  run: <T>(
    task: (signal: AbortSignal) => Promise<T>,
    onSuccess: (result: T) => void,
  ) => Promise<void>
  cancel: () => void
  /** Blendet eine Fehlermeldung aus. */
  reset: () => void
}

/** Zustand und Abbruch einer einzelnen KI-Aufgabe (z. B. „Entscheidungen finden“). */
export function useAiTask(): AiTask {
  const { t } = useTranslation()
  const [state, setState] = useState<AiTaskState>({ status: 'idle' })
  const pending = useRef<AbortController | null>(null)

  // Verlässt der Nutzer die Seite, läuft keine Anfrage mehr im Hintergrund.
  useEffect(() => () => pending.current?.abort(), [])

  const run = useCallback(
    async <T>(task: (signal: AbortSignal) => Promise<T>, onSuccess: (result: T) => void) => {
      pending.current?.abort()
      const controller = new AbortController()
      pending.current = controller
      setState({ status: 'running' })
      try {
        const result = await task(controller.signal)
        if (controller.signal.aborted) return
        onSuccess(result)
        setState({ status: 'idle' })
      } catch (error) {
        if (controller.signal.aborted) return
        if (error instanceof AiError && error.code === 'aborted') {
          setState({ status: 'idle' })
          return
        }
        const errorKey: AiTaskErrorKey =
          error instanceof AiError ? aiErrorKey(error) : 'projects.errors.generic'
        setState({ status: 'error', errorKey, detail: aiErrorDetail(error, t) })
      } finally {
        if (pending.current === controller) pending.current = null
      }
    },
    [t],
  )

  const cancel = useCallback(() => {
    pending.current?.abort()
    pending.current = null
    setState({ status: 'idle' })
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, run, cancel, reset }
}
