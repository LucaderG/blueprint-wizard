import i18n from '@/shared/i18n'

const LOCALES = { de: 'de-DE', en: 'en-US' } as const

/** Gebietsschema der aktuellen Oberflächensprache. */
function locale(): string {
  return i18n.language === 'en' ? LOCALES.en : LOCALES.de
}

// Intl-Formatierer sind teuer; je Sprache und Optionen nur einmal anlegen.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>()

function numberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `n|${locale()}|${JSON.stringify(options)}`
  let format = cache.get(key) as Intl.NumberFormat | undefined
  if (!format) cache.set(key, (format = new Intl.NumberFormat(locale(), options)))
  return format
}

function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d|${locale()}|${JSON.stringify(options)}`
  let format = cache.get(key) as Intl.DateTimeFormat | undefined
  if (!format) cache.set(key, (format = new Intl.DateTimeFormat(locale(), options)))
  return format
}

/** Datum mit Uhrzeit, z. B. „11.10.2026, 14:05“ bzw. „Oct 11, 2026, 2:05 PM“. */
export function formatDateTime(iso: string): string {
  return dateFormat({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

/** Kurzes Datum mit Uhrzeit, z. B. „11.10.26, 14:05“. */
export function formatShortDateTime(iso: string): string {
  return dateFormat({ dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

/** Kurzes Datum, z. B. „11.10.26“. */
export function formatDate(iso: string): string {
  return dateFormat({ dateStyle: 'short' }).format(new Date(iso))
}

/** Prozentwert (0–100), z. B. „40 %“. */
export function formatPercent(value: number): string {
  return numberFormat({ style: 'percent', maximumFractionDigits: 0 }).format(value / 100)
}

/** Ganze Zahl mit Tausendertrennzeichen, z. B. „20.000“. */
export function formatNumber(value: number): string {
  return numberFormat().format(value)
}

/** Zahl mit genau einer Nachkommastelle, z. B. „0,7“. */
export function formatDecimal(value: number): string {
  return numberFormat({ minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
}

/** Dollarbetrag, z. B. „1,25 $“. Kleine Beträge bekommen mehr Nachkommastellen. */
export function formatUsd(value: number): string {
  const small = value !== 0 && Math.abs(value) < 0.01
  return numberFormat({
    style: 'currency',
    currency: 'USD',
    ...(small ? { minimumFractionDigits: 4, maximumFractionDigits: 4 } : {}),
  }).format(value)
}
