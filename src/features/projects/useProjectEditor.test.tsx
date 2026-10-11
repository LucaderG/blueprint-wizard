import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ProjectRepositoryProvider } from '@/app/ProjectRepositoryContext'
import { updateSection, type Project } from '@/core/blueprint'
import { MemoryProjectRepository } from '@/core/storage'
import { AUTOSAVE_DELAY_MS, useProjectEditor, type ProjectEditorState } from './useProjectEditor'

type ReadyState = Extract<ProjectEditorState, { status: 'ready' }>

function readyState(state: ProjectEditorState): ReadyState {
  if (state.status !== 'ready') throw new Error(`Status ist „${state.status}“, nicht „ready“`)
  return state
}

/** Ändert den Problem-Abschnitt; so sieht man in der Datenbank, ob gespeichert wurde. */
const setProblem = (text: string) => (project: Project) =>
  updateSection(project, 'problem', { content: text, maturity: 'vague' })

/** Ein Repository mit einem Projekt; gibt die ID des Projekts zurück. */
async function setup() {
  const repository = new MemoryProjectRepository()
  const project = await repository.create('Testprojekt')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ProjectRepositoryProvider repository={repository}>{children}</ProjectRepositoryProvider>
  )
  return { repository, id: project.id, wrapper }
}

/** Rendert den Hook und wartet, bis das Projekt geladen ist. */
async function renderEditor() {
  const env = await setup()
  const hook = renderHook(() => useProjectEditor(env.id), { wrapper: env.wrapper })
  await waitFor(() => expect(hook.result.current.status).toBe('ready'))
  return { ...env, ...hook, editor: () => readyState(hook.result.current) }
}

/** Lässt die Autosave-Zeit verstreichen und wartet auf die Speichervorgänge. */
async function passAutosave() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
  })
}

beforeEach(() => {
  // Echte Zeit läuft mit, damit RTL-waitFor funktioniert; die Autosave-Zeit lässt sich vorspulen.
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useProjectEditor', () => {
  describe('Laden', () => {
    it('ist zuerst im Ladezustand und wird dann bereit', async () => {
      const { id, wrapper } = await setup()

      const { result } = renderHook(() => useProjectEditor(id), { wrapper })

      expect(result.current.status).toBe('loading')
      await waitFor(() => expect(result.current.status).toBe('ready'))
      const state = readyState(result.current)
      expect(state.project.id).toBe(id)
      expect(state.saveState).toBe('saved')
      expect(state.canUndo).toBe(false)
      expect(state.canRedo).toBe(false)
    })

    it('meldet „notFound“ für eine unbekannte ID', async () => {
      const { wrapper } = await setup()

      const { result } = renderHook(() => useProjectEditor('unbekannt'), { wrapper })

      await waitFor(() => expect(result.current.status).toBe('notFound'))
    })

    it('meldet „error“, wenn das Laden fehlschlägt', async () => {
      const { repository, id, wrapper } = await setup()
      vi.spyOn(repository, 'get').mockRejectedValueOnce(new Error('Datenbank kaputt'))

      const { result } = renderHook(() => useProjectEditor(id), { wrapper })

      await waitFor(() => expect(result.current.status).toBe('error'))
    })
  })

  describe('Bearbeiten und Autosave', () => {
    it('übernimmt eine Änderung sofort in das Projekt und aktiviert „Rückgängig“', async () => {
      const { editor, result } = await renderEditor()

      act(() => editor().edit(setProblem('Neu')))

      expect(readyState(result.current).project.blueprint.sections.problem.content).toBe('Neu')
      expect(readyState(result.current).canUndo).toBe(true)
      expect(readyState(result.current).saveState).toBe('pending')
    })

    it('speichert nach AUTOSAVE_DELAY_MS im Repository', async () => {
      const { editor, repository, id, result } = await renderEditor()
      const save = vi.spyOn(repository, 'save')

      act(() => editor().edit(setProblem('Gespeichert')))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100)
      })
      expect(save).not.toHaveBeenCalled()

      await passAutosave()

      await waitFor(() => expect(readyState(result.current).saveState).toBe('saved'))
      expect(save).toHaveBeenCalledTimes(1)
      const stored = await repository.get(id)
      expect(stored?.blueprint.sections.problem.content).toBe('Gespeichert')
    })

    it('fasst schnelle Änderungen zu einem Speichern des neuesten Stands zusammen', async () => {
      const { editor, repository, id, result } = await renderEditor()
      const save = vi.spyOn(repository, 'save')

      act(() => editor().edit(setProblem('Eins')))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS / 2)
      })
      act(() => editor().edit(setProblem('Zwei')))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS / 2)
      })
      act(() => editor().edit(setProblem('Drei')))
      await passAutosave()

      await waitFor(() => expect(readyState(result.current).saveState).toBe('saved'))
      expect(save).toHaveBeenCalledTimes(1)
      expect((await repository.get(id))?.blueprint.sections.problem.content).toBe('Drei')
    })

    it('ist eine Änderung, die dasselbe Objekt zurückgibt, ein No-op', async () => {
      const { editor, repository, result } = await renderEditor()
      const save = vi.spyOn(repository, 'save')

      act(() => editor().edit((project) => project))
      await passAutosave()

      expect(readyState(result.current).canUndo).toBe(false)
      expect(readyState(result.current).saveState).toBe('saved')
      expect(save).not.toHaveBeenCalled()
    })
  })

  describe('Rückgängig und Wiederholen', () => {
    it('macht Änderungen rückgängig und wieder, und speichert beides', async () => {
      const { editor, repository, id, result } = await renderEditor()

      act(() => editor().edit(setProblem('Erster Stand')))
      act(() => editor().edit(setProblem('Zweiter Stand')))
      await passAutosave()
      await waitFor(() => expect(readyState(result.current).saveState).toBe('saved'))

      act(() => editor().undo())
      expect(readyState(result.current).project.blueprint.sections.problem.content).toBe(
        'Erster Stand',
      )
      expect(readyState(result.current).canRedo).toBe(true)
      await passAutosave()
      await waitFor(() => expect(readyState(result.current).saveState).toBe('saved'))
      expect((await repository.get(id))?.blueprint.sections.problem.content).toBe('Erster Stand')

      act(() => editor().redo())
      expect(readyState(result.current).project.blueprint.sections.problem.content).toBe(
        'Zweiter Stand',
      )
      expect(readyState(result.current).canRedo).toBe(false)
      await passAutosave()
      await waitFor(() => expect(readyState(result.current).saveState).toBe('saved'))
      expect((await repository.get(id))?.blueprint.sections.problem.content).toBe('Zweiter Stand')
    })

    it('macht ohne Verlauf nichts', async () => {
      const { editor, result } = await renderEditor()
      const before = readyState(result.current).project

      act(() => {
        editor().undo()
        editor().redo()
      })

      expect(readyState(result.current).project).toBe(before)
      expect(readyState(result.current).saveState).toBe('saved')
    })
  })

  describe('Sofort speichern', () => {
    it('flush() speichert ohne auf den Timer zu warten', async () => {
      const { editor, repository, id, result } = await renderEditor()
      const save = vi.spyOn(repository, 'save')

      act(() => editor().edit(setProblem('Sofort')))
      await act(() => editor().flush())

      expect(save).toHaveBeenCalledTimes(1)
      expect(readyState(result.current).saveState).toBe('saved')
      expect((await repository.get(id))?.blueprint.sections.problem.content).toBe('Sofort')

      // Der geplante Timer darf danach nichts mehr speichern.
      await passAutosave()
      expect(save).toHaveBeenCalledTimes(1)
    })

    it('speichert beim Verlassen der Seite offene Änderungen', async () => {
      const { editor, repository, id, unmount } = await renderEditor()

      act(() => editor().edit(setProblem('Beim Verlassen')))
      unmount()

      await waitFor(async () =>
        expect((await repository.get(id))?.blueprint.sections.problem.content).toBe(
          'Beim Verlassen',
        ),
      )
    })

    it('speichert bei beforeunload offene Änderungen', async () => {
      const { editor, repository, id } = await renderEditor()
      const save = vi.spyOn(repository, 'save')

      act(() => editor().edit(setProblem('Vor dem Schließen')))
      window.dispatchEvent(new Event('beforeunload'))

      await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
      expect((await repository.get(id))?.blueprint.sections.problem.content).toBe(
        'Vor dem Schließen',
      )
    })
  })

  describe('Speicherfehler', () => {
    it('setzt „error“ und speichert beim nächsten flush erneut', async () => {
      const { editor, repository, id, result } = await renderEditor()
      const save = vi.spyOn(repository, 'save').mockRejectedValueOnce(new Error('Speicher voll'))

      act(() => editor().edit(setProblem('Wichtig')))
      await act(() => editor().flush())

      expect(readyState(result.current).saveState).toBe('error')
      expect((await repository.get(id))?.blueprint.sections.problem.content).toBe('')

      await act(() => editor().flush())

      expect(save).toHaveBeenCalledTimes(2)
      expect(readyState(result.current).saveState).toBe('saved')
      expect((await repository.get(id))?.blueprint.sections.problem.content).toBe('Wichtig')
    })

    it('behält Änderungen, die während eines laufenden Speicherns entstehen', async () => {
      const { editor, repository, id, result } = await renderEditor()
      let release: () => void = () => {}
      const gate = new Promise<void>((resolve) => (release = resolve))
      const original = repository.save.bind(repository)
      vi.spyOn(repository, 'save').mockImplementationOnce(async (project) => {
        await gate
        return original(project)
      })

      act(() => editor().edit(setProblem('Erste Version')))
      let flushing: Promise<void> = Promise.resolve()
      await act(async () => {
        flushing = editor().flush()
      })
      expect(readyState(result.current).saveState).toBe('saving')

      act(() => editor().edit(setProblem('Zweite Version')))
      await act(async () => {
        release()
        await flushing
      })
      expect(readyState(result.current).saveState).toBe('pending')

      await passAutosave()
      await waitFor(() => expect(readyState(result.current).saveState).toBe('saved'))
      expect((await repository.get(id))?.blueprint.sections.problem.content).toBe('Zweite Version')
    })
  })
})

describe('useProjectEditor – Projektwechsel', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('speichert offene Änderungen des alten Projekts, bevor das neue geladen wird', async () => {
    const { repository, id, wrapper } = await setup()
    const other = await repository.create('Zweites Projekt')
    const hook = renderHook(({ projectId }) => useProjectEditor(projectId), {
      wrapper,
      initialProps: { projectId: id },
    })
    await waitFor(() => expect(hook.result.current.status).toBe('ready'))

    act(() => readyState(hook.result.current).edit(setProblem('Noch nicht gespeichert')))
    hook.rerender({ projectId: other.id })
    await waitFor(() => expect(hook.result.current.status).toBe('ready'))

    expect((await repository.get(id))?.blueprint.sections.problem.content).toBe(
      'Noch nicht gespeichert',
    )
    expect(readyState(hook.result.current).project.id).toBe(other.id)
  })
})
