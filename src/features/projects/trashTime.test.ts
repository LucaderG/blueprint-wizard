import { remainingTime } from './trashTime'

const NOW = new Date('2026-10-12T12:00:00.000Z')
const after = (ms: number) => new Date(NOW.getTime() + ms)
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('remainingTime', () => {
  it.each([
    [30 * DAY, { unit: 'days', count: 30 }],
    [2 * DAY, { unit: 'days', count: 2 }],
    [2 * DAY - 1, { unit: 'hours', count: 48 }],
    [17 * HOUR - MINUTE, { unit: 'hours', count: 17 }],
    [HOUR, { unit: 'hours', count: 1 }],
    [HOUR - 1, { unit: 'minutes', count: 60 }],
    [90 * 1000, { unit: 'minutes', count: 2 }],
    [0, { unit: 'minutes', count: 1 }],
    [-DAY, { unit: 'minutes', count: 1 }],
  ])('rundet %i ms auf %j', (ms, expected) => {
    expect(remainingTime(after(ms), NOW)).toEqual(expected)
  })
})
