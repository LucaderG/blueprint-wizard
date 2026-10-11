import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/app/useSettings'
import { AiError } from '@/core/ai'
import type { Project, Question, SectionId } from '@/core/blueprint'
import {
  analyzeBlueprint,
  answerQuestion,
  appendAnswersToSections,
  applyAnalysis,
  applyIntegration,
  deferQuestion,
  integrateAnswers,
  prioritizeQuestions,
  selectRound,
  type IntegrationProposal,
  type Prioritization,
} from '@/core/engine'
import type { ProjectEditorState } from '@/features/projects/useProjectEditor'
import { aiErrorDetail } from '@/features/settings/aiErrorDetail'
import { aiErrorKey, type AiErrorKey } from '@/features/settings/aiErrors'

type ReadyEditor = Extract<ProjectEditorState, { status: 'ready' }>

export type InterviewErrorKey = AiErrorKey | 'projects.errors.generic'

/** Entwurf einer Antwort in der Fragerunde (noch nicht gespeichert). */
export type AnswerDraft =
  | { kind: 'option'; optionId: string; note: string }
  | { kind: 'text'; text: string }
  | { kind: 'later' }

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'error'; errorKey: InterviewErrorKey; detail: string | null }

export type IntegrationState =
  | { status: 'idle' }
  | { status: 'running'; questionIds: string[] }
  | { status: 'review'; questionIds: string[]; proposals: IntegrationProposal[] }
  | { status: 'error'; questionIds: string[]; errorKey: InterviewErrorKey; detail: string | null }

export interface InterviewController {
  /** Fragen der aktuellen Runde (1–3), nach Priorität. */
  round: Question[]
  prioritization: Prioritization
  analysis: AnalysisState
  integration: IntegrationState
  hasAi: boolean
  /** Lässt die KI den Blueprint analysieren und neue Fragen vorschlagen. */
  analyze: () => Promise<void>
  /** Speichert die Antworten der Runde (ein Rückgängig-Schritt) und arbeitet sie ein. */
  submitRound: (drafts: Readonly<Record<string, AnswerDraft>>) => Promise<void>
  acceptProposal: (sectionId: SectionId) => void
  rejectProposal: (sectionId: SectionId) => void
  acceptAllProposals: () => void
  /** Fallback ohne KI: Antworten wörtlich an die Abschnitte anhängen. */
  appendWithoutAi: () => void
  /** Schließt Fehlermeldungen bzw. die Vorschläge, ohne etwas zu übernehmen. */
  dismissIntegration: () => void
  cancel: () => void
}

/** Ob ein Entwurf eine echte Antwort enthält (Option gewählt oder Text eingegeben). */
export function isAnswered(draft: AnswerDraft | undefined): boolean {
  if (!draft) return false
  if (draft.kind === 'option') return true
  if (draft.kind === 'text') return draft.text.trim() !== ''
  return false
}

/** Wendet die Entwürfe einer Runde an. Leere Entwürfe bleiben offen. */
export function applyDrafts(
  project: Project,
  drafts: Readonly<Record<string, AnswerDraft>>,
  now: Date,
): { project: Project; answeredIds: string[] } {
  let next = project
  const answeredIds: string[] = []
  for (const [questionId, draft] of Object.entries(drafts)) {
    if (draft.kind === 'later') {
      next = deferQuestion(next, questionId, now)
    } else if (isAnswered(draft)) {
      next = answerQuestion(next, questionId, draft, now)
      answeredIds.push(questionId)
    }
  }
  return { project: next, answeredIds }
}

function toError(error: unknown, t: Parameters<typeof aiErrorDetail>[1]) {
  const errorKey: InterviewErrorKey =
    error instanceof AiError ? aiErrorKey(error) : 'projects.errors.generic'
  return { errorKey, detail: aiErrorDetail(error, t) }
}

const isAbort = (error: unknown) => error instanceof AiError && error.code === 'aborted'

/**
 * Wurde eine Anfrage abgebrochen (durch `cancel` oder eine neue Anfrage), bleibt kein „läuft“ stehen.
 * Hat `cancel` den Zustand schon gesetzt, bleibt er unverändert.
 */
function resetIfRunning<S extends { status: string }>(state: S): S | { status: 'idle' } {
  return state.status === 'running' ? { status: 'idle' } : state
}

type PendingRef = { current: AbortController | null }

/** Startet eine abbrechbare Anfrage; eine laufende wird vorher abgebrochen. */
function begin(pending: PendingRef): AbortController {
  pending.current?.abort()
  const controller = new AbortController()
  pending.current = controller
  return controller
}

function finish(pending: PendingRef, controller: AbortController) {
  if (pending.current === controller) pending.current = null
}

/**
 * Steuert den Fragenmotor einer Projektseite: Analyse, Fragerunden und das Einarbeiten der Antworten.
 * Alle Änderungen laufen über `editor.edit`, sind also rückgängig zu machen und werden gespeichert.
 */
export function useInterview(editor: ReadyEditor): InterviewController {
  const { t } = useTranslation()
  const { settings, aiProvider } = useSettings()
  const { project, edit } = editor
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle' })
  const [integration, setIntegration] = useState<IntegrationState>({ status: 'idle' })
  const pendingRef = useRef<AbortController | null>(null)

  // Der aktuelle Projektstand für asynchrone Abläufe (nach `await` ist `project` veraltet).
  const projectRef = useRef(project)
  useEffect(() => {
    projectRef.current = project
  }, [project])

  useEffect(() => () => pendingRef.current?.abort(), [])

  const prioritization = useMemo(() => prioritizeQuestions(project), [project])
  const round = useMemo(() => selectRound(project), [project])

  const analyze = useCallback(async () => {
    if (!aiProvider) return
    const controller = begin(pendingRef)
    setAnalysis({ status: 'running' })
    try {
      const { result } = await analyzeBlueprint({
        provider: aiProvider,
        project: projectRef.current,
        language: settings.outputLanguage,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return setAnalysis(resetIfRunning)
      edit((current) => applyAnalysis(current, result, { now: new Date() }))
      setAnalysis({ status: 'idle' })
    } catch (error) {
      if (controller.signal.aborted) return setAnalysis(resetIfRunning)
      if (isAbort(error)) return setAnalysis({ status: 'idle' })
      setAnalysis({ status: 'error', ...toError(error, t) })
    } finally {
      finish(pendingRef, controller)
    }
  }, [aiProvider, edit, settings.outputLanguage, t])

  const integrate = useCallback(
    async (questionIds: string[], basis: Project) => {
      if (questionIds.length === 0) return
      if (!aiProvider) {
        edit((current) => appendAnswersToSections(current, questionIds))
        return
      }
      const controller = begin(pendingRef)
      setIntegration({ status: 'running', questionIds })
      try {
        const { proposals } = await integrateAnswers({
          provider: aiProvider,
          project: basis,
          questionIds,
          language: settings.outputLanguage,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return setIntegration(resetIfRunning)
        setIntegration(
          proposals.length > 0 ? { status: 'review', questionIds, proposals } : { status: 'idle' },
        )
      } catch (error) {
        if (controller.signal.aborted) return setIntegration(resetIfRunning)
        if (isAbort(error)) return setIntegration({ status: 'idle' })
        setIntegration({ status: 'error', questionIds, ...toError(error, t) })
      } finally {
        finish(pendingRef, controller)
      }
    },
    [aiProvider, edit, settings.outputLanguage, t],
  )

  const submitRound = useCallback(
    async (drafts: Readonly<Record<string, AnswerDraft>>) => {
      // Einmal berechnen, damit Ergebnis und Rückgängig-Schritt übereinstimmen.
      const { project: next, answeredIds } = applyDrafts(projectRef.current, drafts, new Date())
      if (next === projectRef.current) return
      edit(() => next)
      projectRef.current = next
      await integrate(answeredIds, next)
    },
    [edit, integrate],
  )

  const removeProposals = useCallback((sectionIds: readonly SectionId[]) => {
    setIntegration((state) => {
      if (state.status !== 'review') return state
      const proposals = state.proposals.filter((p) => !sectionIds.includes(p.sectionId))
      return proposals.length > 0 ? { ...state, proposals } : { status: 'idle' }
    })
  }, [])

  const reviewProposals = useMemo(
    () => (integration.status === 'review' ? integration.proposals : []),
    [integration],
  )

  const acceptProposal = useCallback(
    (sectionId: SectionId) => {
      const proposal = reviewProposals.find((p) => p.sectionId === sectionId)
      if (!proposal) return
      edit((current) => applyIntegration(current, [proposal]))
      removeProposals([sectionId])
    },
    [edit, removeProposals, reviewProposals],
  )

  const rejectProposal = useCallback(
    (sectionId: SectionId) => removeProposals([sectionId]),
    [removeProposals],
  )

  const acceptAllProposals = useCallback(() => {
    if (reviewProposals.length === 0) return
    edit((current) => applyIntegration(current, reviewProposals))
    setIntegration({ status: 'idle' })
  }, [edit, reviewProposals])

  const appendWithoutAi = useCallback(() => {
    if (integration.status !== 'error') return
    const { questionIds } = integration
    edit((current) => appendAnswersToSections(current, questionIds))
    setIntegration({ status: 'idle' })
  }, [edit, integration])

  const dismissIntegration = useCallback(() => setIntegration({ status: 'idle' }), [])

  const cancel = useCallback(() => {
    pendingRef.current?.abort()
    pendingRef.current = null
    setAnalysis({ status: 'idle' })
    setIntegration((state) =>
      state.status === 'running'
        ? {
            status: 'error',
            questionIds: state.questionIds,
            errorKey: 'ai.errors.aborted',
            detail: null,
          }
        : state,
    )
  }, [])

  return {
    round,
    prioritization,
    analysis,
    integration,
    hasAi: aiProvider !== null,
    analyze,
    submitRound,
    acceptProposal,
    rejectProposal,
    acceptAllProposals,
    appendWithoutAi,
    dismissIntegration,
    cancel,
  }
}
