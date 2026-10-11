import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useProjectRepository } from '@/app/useProjectRepository'
import { useSettings } from '@/app/useSettings'
import type { EntryPoint, Project } from '@/core/blueprint'
import { AiError } from '@/core/ai'
import { classifyIdea } from '@/core/engine'
import { aiErrorDetail } from '@/features/settings/aiErrorDetail'
import { aiErrorKey, type AiErrorKey } from '@/features/settings/aiErrors'
import { createProjectFromClassification, createProjectWithoutAi } from './startProject'

export type IdeaErrorKey = AiErrorKey | 'projects.errors.generic'

export type IdeaState =
  | { status: 'idle' }
  | { status: 'running'; mode: 'ai' | 'manual' }
  | { status: 'error'; errorKey: IdeaErrorKey; detail: string | null }

export interface IdeaSubmission {
  text: string
  name: string
  entryPoint: EntryPoint
}

/**
 * Ablauf „Idee einordnen“ bzw. „Ohne KI starten“: Die KI-Anfrage läuft abbrechbar. Erst nach einer
 * erfolgreichen Antwort wird ein Projekt angelegt, damit bei Fehlern keine leeren Projekte entstehen.
 */
export function useIdeaClassification() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const repository = useProjectRepository()
  const { settings, aiProvider } = useSettings()
  const [state, setState] = useState<IdeaState>({ status: 'idle' })
  const pendingRef = useRef<AbortController | null>(null)
  const defaultName = t('wizard.defaultProjectName')

  // Verlässt der Nutzer die Seite, läuft keine Anfrage mehr im Hintergrund.
  useEffect(() => () => pendingRef.current?.abort(), [])

  const openProject = useCallback(
    (project: Project) => navigate(`/projekte/${project.id}`),
    [navigate],
  )

  const classify = useCallback(
    async ({ text, name, entryPoint }: IdeaSubmission) => {
      if (!aiProvider) return
      const controller = new AbortController()
      pendingRef.current = controller
      setState({ status: 'running', mode: 'ai' })
      try {
        const { classification } = await classifyIdea({
          provider: aiProvider,
          text,
          entryPoint,
          language: settings.outputLanguage,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        const project = await createProjectFromClassification(repository, classification, {
          name,
          entryPoint,
          defaultName,
        })
        openProject(project)
      } catch (error) {
        // Der Abbruch hat den Zustand bereits zurückgesetzt; keine Fehlermeldung zeigen.
        if (controller.signal.aborted) return
        if (error instanceof AiError && error.code === 'aborted') {
          setState({ status: 'idle' })
          return
        }
        const errorKey: IdeaErrorKey =
          error instanceof AiError ? aiErrorKey(error) : 'projects.errors.generic'
        setState({ status: 'error', errorKey, detail: aiErrorDetail(error, t) })
      } finally {
        if (pendingRef.current === controller) pendingRef.current = null
      }
    },
    [aiProvider, defaultName, openProject, repository, settings.outputLanguage, t],
  )

  const startWithoutAi = useCallback(
    async ({ text, name, entryPoint }: IdeaSubmission) => {
      setState({ status: 'running', mode: 'manual' })
      try {
        // Eingegebener Text geht nie verloren: ohne KI landet er im Abschnitt „Problem & Vision“.
        const project = await createProjectWithoutAi(
          repository,
          { name, entryPoint, defaultName },
          text,
        )
        openProject(project)
      } catch {
        setState({ status: 'error', errorKey: 'projects.errors.generic', detail: null })
      }
    },
    [defaultName, openProject, repository],
  )

  const cancel = useCallback(() => {
    pendingRef.current?.abort()
    pendingRef.current = null
    setState({ status: 'idle' })
  }, [])

  return { state, classify, startWithoutAi, cancel }
}
