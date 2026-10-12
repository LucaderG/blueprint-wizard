import { useCallback } from 'react'
import { useProjectRepository } from '@/app/useProjectRepository'
import { useSettings } from '@/app/useSettings'
import { AiError } from '@/core/ai'
import type { Project } from '@/core/blueprint'
import { applyVariantCandidates, clampVariantCount, generateVariants } from '@/core/engine'
import { useAiTask } from '@/features/ai/useAiTask'
import { createVariantEntries } from './createVariantEntries'
import { writeVariantsSession, type VariantsSession } from './variantsSession'

export interface GeneratedVariants {
  session: VariantsSession
  entries: Project[]
}

/**
 * „Varianten erzeugen“: Die KI liefert ein bis drei Steckbriefe, daraus entstehen Einträge im
 * Papierkorb. Der Stand für die Variantenseite landet im sessionStorage.
 */
export function useVariantGeneration() {
  const repository = useProjectRepository()
  const { settings, aiProvider } = useSettings()
  const { state, run, cancel, reset } = useAiTask()

  const generate = useCallback(
    async (idea: string, count: number, onDone: (result: GeneratedVariants) => void) => {
      if (!aiProvider) return
      const limit = clampVariantCount(count)
      await run(async (signal) => {
        const { candidates } = await generateVariants({
          provider: aiProvider,
          idea,
          count: limit,
          language: settings.outputLanguage,
          signal,
        })
        const drafts = applyVariantCandidates(candidates, { limit })
        if (drafts.length === 0) {
          throw new AiError('invalidResponse', 'Die Antwort enthält keinen brauchbaren Steckbrief')
        }
        // Nach einem Abbruch entstehen keine Einträge mehr.
        if (signal.aborted) throw new AiError('aborted', 'Abgebrochen')
        const entries = await createVariantEntries(repository, drafts)
        const session: VariantsSession = {
          idea: idea.trim(),
          count: limit,
          ids: entries.map((entry) => entry.id),
        }
        writeVariantsSession(session)
        return { session, entries }
      }, onDone)
    },
    [aiProvider, repository, run, settings.outputLanguage],
  )

  return { state, generate, cancel, reset, available: aiProvider !== null }
}
