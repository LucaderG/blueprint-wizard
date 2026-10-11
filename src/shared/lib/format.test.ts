import { formatDateTime, formatPercent } from './format'

describe('format', () => {
  it('formatiert Datum und Uhrzeit deutsch', () => {
    const iso = new Date(2026, 9, 11, 14, 5).toISOString()
    expect(formatDateTime(iso)).toBe('11.10.2026, 14:05')
  })

  it('formatiert Prozentwerte deutsch', () => {
    expect(formatPercent(40)).toBe('40 %')
    expect(formatPercent(0)).toBe('0 %')
  })
})
