/** Hilfsfunktionen, um KI-Antworten zu bereinigen, bevor sie ins Projekt gelangen. */

/** Vergleichsform eines Textes: getrimmt, klein, Leerraum zusammengefasst. */
export const normalizeText = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ')

/** Begrenzt einen Hebel auf eine ganze Zahl von 1 bis 5; Ungültiges wird zur Mitte (3). */
export function clampLeverage(value: number): number {
  if (!Number.isFinite(value)) return 3
  return Math.min(5, Math.max(1, Math.round(value)))
}

/** Trimmt Einträge, entfernt leere und (ohne Groß-/Kleinschreibung) doppelte, begrenzt die Anzahl. */
export function cleanTextList(items: readonly string[], max = Infinity): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const text = item.trim()
    const key = normalizeText(text)
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }
  return result.slice(0, max)
}

/**
 * Kürzt eine Liste auf `max` Einträge und behält dabei die mit dem höchsten Hebel (bei Gleichstand
 * die früheren). Die ursprüngliche Reihenfolge bleibt erhalten. So entscheidet beim Kürzen nicht
 * die Position in der KI-Antwort.
 */
export function keepHighestLeverage<T>(
  items: readonly T[],
  max: number,
  leverageOf: (item: T) => number,
): T[] {
  if (items.length <= max) return [...items]
  const keep = new Set(
    items
      .map((item, index) => ({ index, leverage: leverageOf(item) }))
      .sort((a, b) => b.leverage - a.leverage || a.index - b.index)
      .slice(0, Math.max(0, max))
      .map((entry) => entry.index),
  )
  return items.filter((_item, index) => keep.has(index))
}
