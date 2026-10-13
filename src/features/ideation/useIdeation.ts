import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useProjectRepository } from '@/app/useProjectRepository'
import { useSettings } from '@/app/useSettings'
import type { IdeaRequest, RefineDirection } from '@/core/ai/prompts'
import type { LibraryStatus } from '@/core/blueprint'
import {
  applyChosenIdea,
  applyIdeas,
  generateIdeas,
  ideaToDraft,
  titlesToAvoid,
} from '@/core/engine'
import {
  EMPTY_SESSION,
  normalizeProfile,
  parseIdeationSession,
  profileStatus,
  type Idea,
  type IdeationProfile,
  type IdeationSession,
} from '@/core/ideation'
import { useAiTask, type AiTaskState } from '@/features/ai/useAiTask'
import { createVariantEntries } from '@/features/variants/createVariantEntries'
import { createProjectWithoutAi } from '@/features/wizard/startProject'

/** Schlüssel im sessionStorage: Der Stand überlebt Neuladen, aber nicht das Schließen des Tabs. */
export const IDEATION_STORAGE_KEY = 'blueprint-wizard:ideation'

function loadSession(): IdeationSession {
  try {
    return parseIdeationSession(sessionStorage.getItem(IDEATION_STORAGE_KEY))
  } catch {
    return EMPTY_SESSION
  }
}

function storeSession(session: IdeationSession | null) {
  try {
    if (session) sessionStorage.setItem(IDEATION_STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(IDEATION_STORAGE_KEY)
  } catch {
    // Ohne Speicher geht nur der Stand beim Neuladen verloren.
  }
}

export type IdeationView = 'questionnaire' | 'ideas'

/** Was gerade läuft, damit die Oberfläche den passenden Text zeigt. */
export type IdeationActivity = IdeaRequest['kind'] | 'choose' | null

export interface IdeationController {
  session: IdeationSession
  view: IdeationView
  hasAi: boolean
  canGenerate: boolean
  task: AiTaskState
  /** Die letzte Anfrage brachte keine brauchbare neue Idee. */
  nothingNew: boolean
  /** Das Projekt konnte nicht angelegt werden. */
  saveFailed: boolean
  activity: IdeationActivity
  /** ID der Idee, an der gerade gearbeitet wird (Abwandeln, Mehr wie diese). */
  busyIdeaId: string | null
  updateProfile: (patch: Partial<IdeationProfile>) => void
  /** Erste Runde oder „Neu würfeln“. */
  generate: () => Promise<void>
  moreLike: (idea: Idea) => Promise<void>
  refine: (idea: Idea, direction: RefineDirection, note?: string) => Promise<void>
  combine: (a: Idea, b: Idea) => Promise<void>
  /** Bibliotheksstatus des Eintrags einer Idee; `undefined`, solange er lädt oder fehlt. */
  entryStatus: (idea: Idea) => LibraryStatus | undefined
  /** Speichert den Eintrag einer Idee in der Bibliothek, ohne sie zu wählen. */
  save: (idea: Idea) => Promise<void>
  /** Speichert den Eintrag der Idee, füllt die Abschnitte und öffnet ihn. */
  choose: (idea: Idea) => Promise<void>
  /** Ohne KI: leeres Projekt, die Antworten zu Frust/Interessen landen als eigener Text. */
  startWithoutAi: () => Promise<void>
  editProfile: () => void
  showIdeas: () => void
  retry: () => Promise<void>
  cancel: () => void
  dismissError: () => void
}

function busyIdeaOf(request: IdeaRequest | null): string | null {
  if (!request) return null
  if (request.kind === 'refine' || request.kind === 'moreLike') return request.idea.id
  return null
}

/** Ablauf der Ideenfindung: Fragebogen, Ideen erzeugen und bearbeiten, Idee wählen. */
export function useIdeation(): IdeationController {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const repository = useProjectRepository()
  const { settings, aiProvider } = useSettings()
  const task = useAiTask()
  const [session, setSession] = useState<IdeationSession>(loadSession)
  const [view, setView] = useState<IdeationView>(() =>
    session.ideas.length > 0 ? 'ideas' : 'questionnaire',
  )
  const [lastRequest, setLastRequest] = useState<IdeaRequest | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [nothingNew, setNothingNew] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const [statuses, setStatuses] = useState<Record<string, LibraryStatus>>({})

  useEffect(() => storeSession(session), [session])

  // Jede gezeigte Idee ist ein Eintrag; hier steht, ob er noch im Papierkorb liegt.
  useEffect(() => {
    let active = true
    void Promise.all(
      session.ideas.map(async (idea) => {
        const entry = await repository.get(idea.id).catch(() => undefined)
        return [idea.id, entry?.library.status] as const
      }),
    ).then((pairs) => {
      if (!active) return
      const next: Record<string, LibraryStatus> = {}
      for (const [id, status] of pairs) if (status) next[id] = status
      setStatuses(next)
    })
    return () => {
      active = false
    }
  }, [repository, session.ideas])

  const running = task.state.status === 'running'

  /** Legt für jede neue Idee einen Eintrag im Papierkorb an; die Idee trägt danach dessen ID. */
  const withEntries = useCallback(
    async (updated: IdeationSession, previous: IdeationSession): Promise<IdeationSession> => {
      const known = new Set(previous.ideas.map((idea) => idea.id))
      const fresh = updated.ideas.filter((idea) => !known.has(idea.id))
      const entries = await createVariantEntries(repository, fresh.map(ideaToDraft), 'noIdea')
      const ids = new Map(fresh.map((idea, index) => [idea.id, entries[index]?.id ?? idea.id]))
      return {
        ...updated,
        ideas: updated.ideas.map((idea) => ({ ...idea, id: ids.get(idea.id) ?? idea.id })),
      }
    },
    [repository],
  )

  const request = useCallback(
    async (next: IdeaRequest) => {
      if (!aiProvider) return
      setLastRequest(next)
      setNothingNew(false)
      const avoidTitles = titlesToAvoid(session, next)
      await task.run(
        async (signal) => {
          const { candidates } = await generateIdeas({
            provider: aiProvider,
            profile: session.profile,
            request: next,
            avoidTitles,
            language: settings.outputLanguage,
            signal,
          })
          // Während der Anfrage ist alles gesperrt; `session` ist also noch aktuell.
          const updated = applyIdeas(session, next, candidates)
          if (updated === session || signal.aborted) return session
          return withEntries(updated, session)
        },
        (updated) => {
          setNothingNew(updated === session)
          setSession(updated)
          if (updated.ideas.length > 0) setView('ideas')
        },
      )
    },
    [aiProvider, session, settings.outputLanguage, task, withEntries],
  )

  const choose = useCallback(
    async (idea: Idea) => {
      setChoosing(true)
      setSaveFailed(false)
      try {
        // Ältere Sitzungen kennen noch keine Einträge; dann entsteht er erst jetzt.
        const entry = (await repository.get(idea.id)) ?? (await repository.create(idea.title))
        const project = await repository.save(applyChosenIdea(entry, idea))
        await repository.restore(project.id)
        storeSession(null)
        void navigate(`/projekte/${project.id}`)
      } catch {
        setChoosing(false)
        setSaveFailed(true)
      }
    },
    [navigate, repository],
  )

  const save = useCallback(
    async (idea: Idea) => {
      setSaveFailed(false)
      try {
        const entry = await repository.restore(idea.id)
        setStatuses((current) => ({ ...current, [idea.id]: entry.library.status }))
      } catch {
        setSaveFailed(true)
      }
    },
    [repository],
  )

  const startWithoutAi = useCallback(async () => {
    const { interests, frustrations } = normalizeProfile(session.profile)
    const text = [frustrations, interests.join(', ')].filter(Boolean).join('\n\n')
    setChoosing(true)
    setSaveFailed(false)
    try {
      const project = await createProjectWithoutAi(
        repository,
        { name: '', entryPoint: 'noIdea', defaultName: t('wizard.defaultProjectName') },
        text,
      )
      storeSession(null)
      void navigate(`/projekte/${project.id}`)
    } catch {
      setChoosing(false)
      setSaveFailed(true)
    }
  }, [navigate, repository, session.profile, t])

  return {
    session,
    view,
    hasAi: aiProvider !== null,
    canGenerate: aiProvider !== null && profileStatus(session.profile).canGenerate && !running,
    task: task.state,
    nothingNew,
    saveFailed,
    activity: choosing ? 'choose' : running ? (lastRequest?.kind ?? null) : null,
    busyIdeaId: running ? busyIdeaOf(lastRequest) : null,
    updateProfile: (patch) =>
      setSession((current) => ({ ...current, profile: { ...current.profile, ...patch } })),
    generate: () => request({ kind: 'generate' }),
    moreLike: (idea) => request({ kind: 'moreLike', idea }),
    refine: (idea, direction, note = '') => request({ kind: 'refine', idea, direction, note }),
    combine: (a, b) => request({ kind: 'combine', ideas: [a, b] }),
    entryStatus: (idea) => statuses[idea.id],
    save,
    choose,
    startWithoutAi,
    editProfile: () => setView('questionnaire'),
    showIdeas: () => session.ideas.length > 0 && setView('ideas'),
    retry: () => (lastRequest ? request(lastRequest) : Promise.resolve()),
    cancel: task.cancel,
    dismissError: () => {
      task.reset()
      setNothingNew(false)
      setSaveFailed(false)
    },
  }
}
