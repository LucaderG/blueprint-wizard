const LOCALE = 'de-DE'

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
const percentFormat = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 })

/** Formatiert einen ISO-Zeitstempel als deutsches Datum mit Uhrzeit, z. B. „11.10.2026, 14:05“. */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

/** Formatiert einen Prozentwert (0–100) deutsch, z. B. „40 %“. */
export function formatPercent(value: number): string {
  return percentFormat.format(value / 100)
}
