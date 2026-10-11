import { useEffect, useState } from 'react'
import { listOpenRouterModels, type ModelInfo } from '@/core/ai'

export type ModelCatalogState =
  | { status: 'loading' }
  | { status: 'ready'; models: ModelInfo[] }
  | { status: 'error'; error: unknown }

/** Lädt die OpenRouter-Modellliste beim Mount. `retry` lädt sie erneut. */
export function useModelCatalog() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ModelCatalogState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    listOpenRouterModels({ signal: controller.signal }).then(
      (models) => {
        if (!controller.signal.aborted) setState({ status: 'ready', models })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error })
      },
    )
    return () => controller.abort()
  }, [attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((count) => count + 1)
  }

  return { state, retry }
}
