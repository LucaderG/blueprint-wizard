import { useTranslation } from 'react-i18next'
import type { InterviewLogEntry } from '@/core/blueprint'

const dateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short',
  timeStyle: 'short',
})

interface InterviewHistoryProps {
  log: readonly InterviewLogEntry[]
}

/** Verlauf aller beantworteten und zurückgestellten Fragen, neueste zuerst. Standardmäßig eingeklappt. */
export function InterviewHistory({ log }: InterviewHistoryProps) {
  const { t } = useTranslation()
  // Der Verlauf wird nur angehängt, daher ist die umgekehrte Reihenfolge die neueste zuerst.
  const entries = [...log].reverse()

  return (
    <details className="rounded-lg border bg-card p-4">
      <summary className="cursor-pointer font-semibold">
        {t('interview.history.summary', { count: log.length })}
      </summary>
      <div className="mt-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('interview.history.empty')}</p>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => (
              <li
                key={`${entry.at}-${entry.questionId}`}
                className="space-y-1 border-t pt-3 first:border-t-0 first:pt-0"
              >
                <p className="text-xs text-muted-foreground">
                  <time dateTime={entry.at}>{dateTimeFormat.format(new Date(entry.at))}</time>
                  {' · '}
                  {t(`sections.${entry.sectionId}`)}
                </p>
                <p className="text-sm font-medium break-words">{entry.questionText}</p>
                <p className="text-sm break-words whitespace-pre-wrap">
                  {entry.action === 'deferred' || entry.answerText === ''
                    ? t('interview.history.later')
                    : entry.answerText}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  )
}
