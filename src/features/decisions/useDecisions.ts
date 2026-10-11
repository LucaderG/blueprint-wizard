import { useCallback, useMemo } from 'react'
import { useSettings } from '@/app/useSettings'
import type { Addition, AdditionSectionId, AnalysisFinding, Project } from '@/core/blueprint'
import { ADDITION_SECTION_IDS } from '@/core/blueprint'
import {
  AdditionError,
  DecisionError,
  acceptAddition,
  applyAdditionCandidates,
  applyDecisionCandidates,
  decide as decideDecision,
  detectContradictions,
  dismissDecision,
  identifyDecisions,
  rankDecisions,
  rejectAddition,
  reopenDecision,
  suggestAdditions,
  type Contradiction,
  type DecisionRanking,
} from '@/core/engine'
import { useAiTask, type AiTaskState } from '@/features/ai/useAiTask'
import type { ProjectEditorState } from '@/features/projects/useProjectEditor'

type ReadyEditor = Extract<ProjectEditorState, { status: 'ready' }>

export interface DecisionsController {
  ranking: DecisionRanking
  /** Regelbasierte Widersprüche (immer aktuell). */
  contradictions: Contradiction[]
  /** Widersprüche aus der letzten KI-Analyse des Fragenmotors. */
  aiContradictions: AnalysisFinding[]
  /** Offene Vorschläge je Abschnitt (Reihenfolge wie `ADDITION_SECTION_IDS`). */
  openAdditions: Record<AdditionSectionId, Addition[]>
  acceptedCount: number
  rejectedCount: number
  identifyState: AiTaskState
  suggestState: AiTaskState
  hasAi: boolean
  identify: () => Promise<void>
  suggest: () => Promise<void>
  cancelIdentify: () => void
  cancelSuggest: () => void
  decide: (decisionId: string, optionId: string, rationale: string) => void
  reopen: (decisionId: string) => void
  dismiss: (decisionId: string) => void
  accept: (additionId: string) => void
  reject: (additionId: string) => void
}

/**
 * Steuert die Seite „Entscheidungen & Vorschläge“. Alle Änderungen laufen über `editor.edit`,
 * sind also rückgängig zu machen und werden automatisch gespeichert.
 */
export function useDecisions(editor: ReadyEditor): DecisionsController {
  const { settings, aiProvider } = useSettings()
  const { project, edit } = editor
  const identifyTask = useAiTask()
  const suggestTask = useAiTask()

  const ranking = useMemo(() => rankDecisions(project), [project])
  const contradictions = useMemo(() => detectContradictions(project), [project])
  const openAdditions = useMemo(() => {
    const groups = Object.fromEntries(ADDITION_SECTION_IDS.map((id) => [id, [] as Addition[]]))
    for (const addition of project.additions) {
      if (addition.status === 'open') groups[addition.sectionId]?.push(addition)
    }
    return groups as Record<AdditionSectionId, Addition[]>
  }, [project])

  const { run: runIdentify } = identifyTask
  const identify = useCallback(async () => {
    if (!aiProvider) return
    await runIdentify(
      (signal) =>
        identifyDecisions({
          provider: aiProvider,
          project,
          language: settings.outputLanguage,
          signal,
        }),
      ({ result }) =>
        edit((current) => applyDecisionCandidates(current, result, { now: new Date() })),
    )
  }, [aiProvider, edit, project, runIdentify, settings.outputLanguage])

  const { run: runSuggest } = suggestTask
  const suggest = useCallback(async () => {
    if (!aiProvider) return
    await runSuggest(
      (signal) =>
        suggestAdditions({
          provider: aiProvider,
          project,
          language: settings.outputLanguage,
          signal,
        }),
      ({ result }) =>
        edit((current) => applyAdditionCandidates(current, result, { now: new Date() })),
    )
  }, [aiProvider, edit, project, runSuggest, settings.outputLanguage])

  // Veraltete IDs (z. B. nach Rückgängig in einem anderen Tab) sind kein Absturz, sondern ein No-op.
  const safeEdit = useCallback(
    (change: (project: Project) => Project) =>
      edit((current) => {
        try {
          return change(current)
        } catch (error) {
          if (error instanceof DecisionError || error instanceof AdditionError) return current
          throw error
        }
      }),
    [edit],
  )

  const decide = useCallback(
    (decisionId: string, optionId: string, rationale: string) =>
      safeEdit((current) => decideDecision(current, decisionId, optionId, rationale, new Date())),
    [safeEdit],
  )
  const reopen = useCallback(
    (decisionId: string) => safeEdit((current) => reopenDecision(current, decisionId)),
    [safeEdit],
  )
  const dismiss = useCallback(
    (decisionId: string) => safeEdit((current) => dismissDecision(current, decisionId)),
    [safeEdit],
  )
  const accept = useCallback(
    (additionId: string) => safeEdit((current) => acceptAddition(current, additionId, new Date())),
    [safeEdit],
  )
  const reject = useCallback(
    (additionId: string) => safeEdit((current) => rejectAddition(current, additionId, new Date())),
    [safeEdit],
  )

  return {
    ranking,
    contradictions,
    aiContradictions: project.interview.analysis?.contradictions ?? [],
    openAdditions,
    acceptedCount: project.additions.filter((a) => a.status === 'accepted').length,
    rejectedCount: project.additions.filter((a) => a.status === 'rejected').length,
    identifyState: identifyTask.state,
    suggestState: suggestTask.state,
    hasAi: aiProvider !== null,
    identify,
    suggest,
    cancelIdentify: identifyTask.cancel,
    cancelSuggest: suggestTask.cancel,
    decide,
    reopen,
    dismiss,
    accept,
    reject,
  }
}
