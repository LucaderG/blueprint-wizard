import { useCallback, useEffect, useRef, useState } from 'react'
import { useProjectRepository } from '@/app/useProjectRepository'
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redo as redoHistory,
  undo as undoHistory,
  type History,
  type Project,
} from '@/core/blueprint'

/** Wartezeit nach der letzten Änderung, bevor automatisch gespeichert wird. */
export const AUTOSAVE_DELAY_MS = 600

export type SaveState = 'saved' | 'pending' | 'saving' | 'error'

export type ProjectEditorState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | {
      status: 'ready'
      project: Project
      saveState: SaveState
      canUndo: boolean
      canRedo: boolean
      /** Wendet eine Änderung an, merkt sie für „Rückgängig“ und speichert verzögert. */
      edit: (change: (project: Project) => Project) => void
      undo: () => void
      redo: () => void
      /** Speichert sofort (z. B. vor dem Verlassen der Seite). */
      flush: () => Promise<void>
    }

type Loaded = { id: string; status: 'notFound' | 'error' } | { id: string; status: 'ready' }

/**
 * Lädt ein Projekt zum Bearbeiten, mit Rückgängig/Wiederholen und automatischem Speichern.
 * Speichervorgänge laufen nacheinander und speichern immer den neuesten Stand.
 */
export function useProjectEditor(id: string): ProjectEditorState {
  const repository = useProjectRepository()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [history, setHistory] = useState<History<Project> | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')

  // Der Verlauf liegt zusätzlich in einer Ref, damit Änderungen ohne Seiteneffekte im State-Updater
  // berechnet werden können (React darf Updater doppelt ausführen). Geschrieben wird er nur beim
  // Laden und in `apply`.
  const historyRef = useRef<History<Project> | null>(null)
  const latest = useRef<Project | null>(null)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let active = true
    repository.get(id).then(
      (project) => {
        if (!active) return
        if (!project) return setLoaded({ id, status: 'notFound' })
        latest.current = project
        dirty.current = false
        historyRef.current = createHistory(project)
        setHistory(historyRef.current)
        setSaveState('saved')
        setLoaded({ id, status: 'ready' })
      },
      () => {
        if (active) setLoaded({ id, status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [id, repository])

  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current)
    timer.current = undefined
    queue.current = queue.current.then(async () => {
      const project = latest.current
      if (!dirty.current || !project) return
      dirty.current = false
      setSaveState('saving')
      try {
        await repository.save(project)
        setSaveState(dirty.current ? 'pending' : 'saved')
      } catch {
        dirty.current = true
        setSaveState('error')
      }
    })
    return queue.current
  }, [repository])

  const scheduleSave = useCallback(
    (project: Project) => {
      latest.current = project
      dirty.current = true
      setSaveState('pending')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS)
    },
    [flush],
  )

  // Beim Verlassen der Seite, Schließen des Tabs oder Wechsel zu einem anderen Projekt nichts verlieren.
  // Der Aufräum-Effekt läuft vor dem Laden des neuen Projekts, `latest` hält dann noch das alte.
  useEffect(() => {
    const onBeforeUnload = () => void flush()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      void flush()
    }
  }, [flush, id])

  const apply = useCallback(
    (step: (history: History<Project>) => History<Project>) => {
      const current = historyRef.current
      if (!current) return
      const next = step(current)
      if (next === current) return
      historyRef.current = next
      setHistory(next)
      scheduleSave(next.present)
    },
    [scheduleSave],
  )

  const edit = useCallback(
    (change: (project: Project) => Project) =>
      apply((current) => pushHistory(current, change(current.present))),
    [apply],
  )
  const undo = useCallback(() => apply(undoHistory), [apply])
  const redo = useCallback(() => apply(redoHistory), [apply])

  if (!loaded || loaded.id !== id) return { status: 'loading' }
  if (loaded.status !== 'ready' || !history)
    return { status: loaded.status === 'ready' ? 'loading' : loaded.status }
  return {
    status: 'ready',
    project: history.present,
    saveState,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    edit,
    undo,
    redo,
    flush,
  }
}
