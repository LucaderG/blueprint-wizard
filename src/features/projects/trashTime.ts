/** Restzeit bis zur Endlöschung, gerundet auf eine gut lesbare Einheit. */
export interface RemainingTime {
  unit: 'days' | 'hours' | 'minutes'
  count: number
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Ab zwei Tagen in Tagen, ab einer Stunde in Stunden, sonst in Minuten (mindestens 1). Aufgerundet,
 * damit „noch 1 Std.“ nicht schon 59 Minuten vor dem Ende erscheint.
 */
export function remainingTime(expiresAt: Date, now: Date): RemainingTime {
  const ms = Math.max(0, expiresAt.getTime() - now.getTime())
  if (ms >= 2 * DAY) return { unit: 'days', count: Math.ceil(ms / DAY) }
  if (ms >= HOUR) return { unit: 'hours', count: Math.ceil(ms / HOUR) }
  return { unit: 'minutes', count: Math.max(1, Math.ceil(ms / MINUTE)) }
}
