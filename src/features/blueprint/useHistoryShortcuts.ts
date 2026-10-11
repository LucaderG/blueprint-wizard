import { useEffect } from 'react'

export interface HistoryShortcutOptions {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

/** Eingabefelder, in denen die Tastenkombinationen dem Browser (natives Rückgängig) gehören. */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

/** True, wenn der Tastendruck in ein Textfeld geht. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type)
  return false
}

/**
 * Ctrl/Cmd+Z macht rückgängig, Ctrl/Cmd+Shift+Z und Ctrl+Y stellt wieder her.
 * In Textfeldern bleibt es beim nativen Verhalten des Browsers.
 */
export function useHistoryShortcuts({ canUndo, canRedo, undo, redo }: HistoryShortcutOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (isTextEntryTarget(event.target)) return

      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        if (!canUndo) return
        event.preventDefault()
        undo()
      } else if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)) {
        if (!canRedo) return
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canUndo, canRedo, undo, redo])
}
