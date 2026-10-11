import {
  canRedo,
  canUndo,
  createHistory,
  DEFAULT_HISTORY_LIMIT,
  pushHistory,
  redo,
  undo,
} from './history'

describe('createHistory', () => {
  it('startet ohne Vergangenheit und Zukunft', () => {
    expect(createHistory('a')).toEqual({ past: [], present: 'a', future: [] })
  })
})

describe('pushHistory', () => {
  it('legt den bisherigen Stand in die Vergangenheit und setzt den neuen', () => {
    const history = pushHistory(createHistory(1), 2)

    expect(history).toEqual({ past: [1], present: 2, future: [] })
  })

  it('verwirft die Zukunft', () => {
    const undone = undo(pushHistory(createHistory(1), 2))

    const pushed = pushHistory(undone, 3)

    expect(pushed.future).toEqual([])
    expect(pushed).toEqual({ past: [1], present: 3, future: [] })
  })

  it('liefert denselben Verlauf zurück, wenn der Stand gleich bleibt', () => {
    const history = createHistory(1)

    expect(pushHistory(history, history.present)).toBe(history)
    expect(pushHistory(history, 1)).toBe(history)
  })

  it('wirft die ältesten Schritte weg, wenn das Limit erreicht ist', () => {
    let history = createHistory(0)
    for (const value of [1, 2, 3, 4]) history = pushHistory(history, value, 2)

    expect(history).toEqual({ past: [2, 3], present: 4, future: [] })
  })

  it('verwendet standardmäßig ein Limit von 50 Schritten', () => {
    let history = createHistory(0)
    for (let i = 1; i <= DEFAULT_HISTORY_LIMIT + 5; i++) history = pushHistory(history, i)

    expect(history.past).toHaveLength(DEFAULT_HISTORY_LIMIT)
    expect(history.past[0]).toBe(5)
    expect(history.present).toBe(DEFAULT_HISTORY_LIMIT + 5)
  })

  it('leert die Vergangenheit bei Limit 0', () => {
    expect(pushHistory(createHistory(1), 2, 0)).toEqual({ past: [], present: 2, future: [] })
  })
})

describe('undo und redo', () => {
  it('macht Schritt für Schritt rückgängig und wieder', () => {
    let history = createHistory('a')
    history = pushHistory(history, 'b')
    history = pushHistory(history, 'c')
    history = pushHistory(history, 'd')

    history = undo(history)
    expect(history).toEqual({ past: ['a', 'b'], present: 'c', future: ['d'] })
    history = undo(history)
    expect(history).toEqual({ past: ['a'], present: 'b', future: ['c', 'd'] })

    history = redo(history)
    expect(history).toEqual({ past: ['a', 'b'], present: 'c', future: ['d'] })
    history = redo(history)
    expect(history).toEqual({ past: ['a', 'b', 'c'], present: 'd', future: [] })
  })

  it('liefert bei undo ohne Vergangenheit denselben Verlauf zurück', () => {
    const history = createHistory('a')

    expect(undo(history)).toBe(history)
  })

  it('liefert bei redo ohne Zukunft denselben Verlauf zurück', () => {
    const history = pushHistory(createHistory('a'), 'b')

    expect(redo(history)).toBe(history)
  })

  it('kann nach dem Rückgängigmachen am Anfang nicht weiter zurück', () => {
    const history = undo(pushHistory(createHistory('a'), 'b'))

    const again = undo(history)

    expect(again).toBe(history)
    expect(canUndo(again)).toBe(false)
  })
})

describe('canUndo und canRedo', () => {
  it('zeigen an, ob es Schritte in die jeweilige Richtung gibt', () => {
    const fresh = createHistory('a')
    expect(canUndo(fresh)).toBe(false)
    expect(canRedo(fresh)).toBe(false)

    const edited = pushHistory(fresh, 'b')
    expect(canUndo(edited)).toBe(true)
    expect(canRedo(edited)).toBe(false)

    const undone = undo(edited)
    expect(canUndo(undone)).toBe(false)
    expect(canRedo(undone)).toBe(true)
  })
})
