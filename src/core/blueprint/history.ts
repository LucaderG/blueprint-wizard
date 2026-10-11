/**
 * Einfacher Verlauf für „Rückgängig“ und „Wiederholen“. Rein funktional: jede Operation liefert
 * einen neuen Verlauf. `present` ist der aktuelle Stand.
 */
export interface History<T> {
  past: T[]
  present: T
  future: T[]
}

export const DEFAULT_HISTORY_LIMIT = 50

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

/** Neuer Stand; `limit` begrenzt die Zahl der Schritte, die rückgängig gemacht werden können. */
export function pushHistory<T>(
  history: History<T>,
  next: T,
  limit = DEFAULT_HISTORY_LIMIT,
): History<T> {
  if (Object.is(next, history.present)) return history
  const past = [...history.past, history.present]
  return { past: past.slice(Math.max(0, past.length - limit)), present: next, future: [] }
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1)
  if (previous === undefined) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...future] = history.future
  if (next === undefined) return history
  return { past: [...history.past, history.present], present: next, future }
}

export const canUndo = <T>(history: History<T>) => history.past.length > 0
export const canRedo = <T>(history: History<T>) => history.future.length > 0
