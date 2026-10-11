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
  revertIntegration,
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
  | {
      status: 'done'
      questionIds: string[]
      /** Automatisch übernommene Änderungen (lassen sich mit `revertApplied` zurücknehmen). */
      applied: IntegrationProposal[]
      /** Änderungen, die deutlich kürzen und deshalb erst nach Bestätigung übernommen werden. */
      toReview: IntegrationProposal[]
    }
  | { status: 'error'; questionIds: string[]; errorKey: InterviewErrorKey; detail: string | null }

export interface InterviewController {
  /** Alle Fragen, die gerade gestellt werden können, nach Priorität. */
  round: Question[]
  prioritization: Prioritization
  analysis: AnalysisState
  integration: IntegrationState
  hasAi: boolean
  /** Lässt die KI den Blueprint analysieren und neue Fragen vorschlagen. */
  analyze: () => Promise<void>
  /**
   * Speichert alle Antworten und arbeitet sie mit einem Klick ein: Die KI formuliert die Abschnitte,
   * die Änderungen werden direkt übernommen (rückgängig machbar). Nur stark kürzende Änderungen
   * warten auf Bestätigung. Sind danach keine Fragen mehr offen, wird neu analysiert.
   */
  submitRound: (drafts: Readonly<Record<string, AnswerDraft>>) => Promise<void>
  /** Nimmt die zuletzt automatisch übernommenen Änderungen zurück. */
  revertApplied: () => void
  acceptProposal: (sectionId: SectionId) => void
  rejectProposal: (sectionId: SectionId) => void
  /** Versucht das Einarbeiten nach einem Fehler noch einmal. */
  retryIntegration: () => Promise<void>
  /** Fallback ohne KI: Antworten wörtlich an die Abschnitte anhängen. */
  appendWithoutAi: () => void
  /** Schließt die Zusammenfassung bzw. Fehlermeldung. */
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

  /**
   * Neue Fragen holen, sobald keine stellbare Frage mehr offen ist (nach einer Runde). Übrig gebliebene
   * „Später“-Fragen zählen nicht, sonst tauchte die eben zurückgestellte Frage sofort wieder auf.
   */
  const analyzeIfExhausted = useCallback(
    (current: Project) => {
      if (prioritizeQuestions(current).ready.length === 0) void analyze()
    },
    [analyze],
  )

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
        const applied = proposals.filter((p) => !p.shrinkWarning)
        const toReview = proposals.filter((p) => p.shrinkWarning)
        if (applied.length > 0) {
          const next = applyIntegration(projectRef.current, applied)
          edit(() => next)
          projectRef.current = next
        }
        setIntegration(
          proposals.length > 0
            ? { status: 'done', questionIds, applied, toReview }
            : { status: 'idle' },
        )
        analyzeIfExhausted(projectRef.current)
      } catch (error) {
        if (controller.signal.aborted) return setIntegration(resetIfRunning)
        if (isAbort(error)) return setIntegration({ status: 'idle' })
        setIntegration({ status: 'error', questionIds, ...toError(error, t) })
      } finally {
        finish(pendingRef, controller)
      }
    },
    [aiProvider, analyzeIfExhausted, edit, settings.outputLanguage, t],
  )

  const submitRound = useCallback(
    async (drafts: Readonly<Record<string, AnswerDraft>>) => {
      // Einmal berechnen, damit Ergebnis und Rückgängig-Schritt übereinstimmen.
      const { project: next, answeredIds } = applyDrafts(projectRef.current, drafts, new Date())
      if (next === projectRef.current) return
      edit(() => next)
      projectRef.current = next
      if (answeredIds.length > 0) await integrate(answeredIds, next)
      else analyzeIfExhausted(next)
    },
    [analyzeIfExhausted, edit, integrate],
  )

  const retryIntegration = useCallback(async () => {
    if (integration.status !== 'error') return
    await integrate(integration.questionIds, projectRef.current)
  }, [integrate, integration])

  const revertApplied = useCallback(() => {
    if (integration.status !== 'done' || integration.applied.length === 0) return
    const { applied } = integration
    edit((current) => revertIntegration(current, applied))
    setIntegration((state) =>
      state.status === 'done'
        ? state.toReview.length > 0
          ? { ...state, applied: [] }
          : { status: 'idle' }
        : state,
    )
  }, [edit, integration])

  const removeFromReview = useCallback((sectionId: SectionId) => {
    setIntegration((state) => {
      if (state.status !== 'done') return state
      const toReview = state.toReview.filter((p) => p.sectionId !== sectionId)
      return toReview.length > 0 || state.applied.length > 0
        ? { ...state, toReview }
        : { status: 'idle' }
    })
  }, [])

  const acceptProposal = useCallback(
    (sectionId: SectionId) => {
      if (integration.status !== 'done') return
      const proposal = integration.toReview.find((p) => p.sectionId === sectionId)
      if (!proposal) return
      edit((current) => applyIntegration(current, [proposal]))
      setIntegration((state) =>
        state.status === 'done'
          ? {
              ...state,
              applied: [...state.applied, proposal],
              toReview: state.toReview.filter((p) => p.sectionId !== sectionId),
            }
          : state,
      )
    },
    [edit, integration],
  )

  const rejectProposal = useCallback(
    (sectionId: SectionId) => removeFromReview(sectionId),
    [removeFromReview],
  )

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

  // Erster Besuch ohne Analyse und ohne Fragen: gleich analysieren, statt auf einen Klick zu warten.
  const autoAnalyzed = useRef(false)
  useEffect(() => {
    if (autoAnalyzed.current || !aiProvider) return
    const { interview } = projectRef.current
    const hasPending = interview.questions.some(
      (q) => q.status === 'open' || q.status === 'deferred',
    )
    if (interview.analysis !== null || hasPending) return
    autoAnalyzed.current = true
    void analyze()
  }, [aiProvider, analyze])

  return {
    round,
    prioritization,
    analysis,
    integration,
    hasAi: aiProvider !== null,
    analyze,
    submitRound,
    revertApplied,
    acceptProposal,
    rejectProposal,
    retryIntegration,
    appendWithoutAi,
    dismissIntegration,
    cancel,
  }
}
