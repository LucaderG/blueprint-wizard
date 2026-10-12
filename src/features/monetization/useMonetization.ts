import { useCallback, useMemo } from 'react'
import { useSettings } from '@/app/useSettings'
import type {
  Monetization,
  MonetizationModelKind,
  PricingStrategyKind,
  Project,
  SectionId,
} from '@/core/blueprint'
import {
  addManualModel,
  addManualPricing,
  appendImpactNote,
  applyModelCandidates,
  applyPricingCandidates,
  chooseModels as chooseModelsIn,
  choosePricing as choosePricingIn,
  finalizeMonetization,
  MonetizationError,
  monetizationAvailability,
  monetizationImpacts,
  reopenMonetization,
  resetMonetization,
  suggestMonetizationModels,
  suggestPricingStrategies,
  type MonetizationAvailability,
  type MonetizationImpact,
} from '@/core/engine'
import { useAiTask, type AiTaskState } from '@/features/ai/useAiTask'
import type { ProjectEditorState } from '@/features/projects/useProjectEditor'

type ReadyEditor = Extract<ProjectEditorState, { status: 'ready' }>

export interface MonetizationController {
  monetization: Monetization | null
  availability: MonetizationAvailability
  impacts: MonetizationImpact[]
  modelsState: AiTaskState
  pricingState: AiTaskState
  hasAi: boolean
  suggestModels: () => Promise<void>
  suggestPricing: () => Promise<void>
  cancelModels: () => void
  cancelPricing: () => void
  addModel: (kind: MonetizationModelKind) => void
  addPricing: (strategy: PricingStrategyKind) => void
  chooseModels: (modelIds: string[], rationale: string) => void
  choosePricing: (optionIds: string[], rationale: string) => void
  finalize: () => void
  reopen: () => void
  reset: () => void
  applyImpact: (sectionId: SectionId, text: string) => void
}

/**
 * Steuert die Seite „Monetarisierung“. Alle Änderungen laufen über `editor.edit`, sind also
 * rückgängig zu machen und werden automatisch gespeichert.
 */
export function useMonetization(editor: ReadyEditor): MonetizationController {
  const { settings, aiProvider } = useSettings()
  const { project, edit } = editor
  const modelsTask = useAiTask()
  const pricingTask = useAiTask()

  const availability = useMemo(() => monetizationAvailability(project), [project])
  const impacts = useMemo(
    () => (project.monetization ? monetizationImpacts(project.monetization) : []),
    [project.monetization],
  )

  // Veraltete IDs (z. B. nach Rückgängig in einem anderen Tab) sind kein Absturz, sondern ein No-op.
  const safeEdit = useCallback(
    (change: (project: Project) => Project) =>
      edit((current) => {
        try {
          return change(current)
        } catch (error) {
          if (error instanceof MonetizationError) return current
          throw error
        }
      }),
    [edit],
  )

  const { run: runModels } = modelsTask
  const suggestModels = useCallback(async () => {
    if (!aiProvider) return
    await runModels(
      (signal) =>
        suggestMonetizationModels({
          provider: aiProvider,
          project,
          language: settings.outputLanguage,
          signal,
        }),
      ({ result }) => safeEdit((current) => applyModelCandidates(current, result)),
    )
  }, [aiProvider, project, runModels, safeEdit, settings.outputLanguage])

  const { run: runPricing } = pricingTask
  const suggestPricing = useCallback(async () => {
    if (!aiProvider) return
    await runPricing(
      (signal) =>
        suggestPricingStrategies({
          provider: aiProvider,
          project,
          language: settings.outputLanguage,
          signal,
        }),
      ({ result }) => safeEdit((current) => applyPricingCandidates(current, result)),
    )
  }, [aiProvider, project, runPricing, safeEdit, settings.outputLanguage])

  const addModel = useCallback(
    (kind: MonetizationModelKind) => safeEdit((current) => addManualModel(current, kind)),
    [safeEdit],
  )
  const addPricing = useCallback(
    (strategy: PricingStrategyKind) => safeEdit((current) => addManualPricing(current, strategy)),
    [safeEdit],
  )
  const chooseModels = useCallback(
    (modelIds: string[], rationale: string) =>
      safeEdit((current) => chooseModelsIn(current, modelIds, rationale)),
    [safeEdit],
  )
  const choosePricing = useCallback(
    (optionIds: string[], rationale: string) =>
      safeEdit((current) => choosePricingIn(current, optionIds, rationale)),
    [safeEdit],
  )
  const finalize = useCallback(
    () => safeEdit((current) => finalizeMonetization(current, new Date())),
    [safeEdit],
  )
  const reopen = useCallback(() => safeEdit(reopenMonetization), [safeEdit])
  const reset = useCallback(() => {
    modelsTask.cancel()
    pricingTask.cancel()
    safeEdit(resetMonetization)
  }, [modelsTask, pricingTask, safeEdit])
  const applyImpact = useCallback(
    (sectionId: SectionId, text: string) =>
      safeEdit((current) => appendImpactNote(current, sectionId, text)),
    [safeEdit],
  )

  return {
    monetization: project.monetization,
    availability,
    impacts,
    modelsState: modelsTask.state,
    pricingState: pricingTask.state,
    hasAi: aiProvider !== null,
    suggestModels,
    suggestPricing,
    cancelModels: modelsTask.cancel,
    cancelPricing: pricingTask.cancel,
    addModel,
    addPricing,
    chooseModels,
    choosePricing,
    finalize,
    reopen,
    reset,
    applyImpact,
  }
}
