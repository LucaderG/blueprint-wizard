import { Check, LoaderCircle } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Question } from '@/core/blueprint'
import { Button } from '@/shared/ui/button'
import { EMPTY_CARD_DRAFT, toAnswerDraft, type CardDraft } from './cardDraft'
import { QuestionCard } from './QuestionCard'
import type { AnswerDraft } from './useInterview'

interface QuestionRoundProps {
  round: Question[]
  /** Anzahl der Fragen, die noch auf andere Antworten warten. */
  blockedCount: number
  analysisRunning: boolean
  integrationRunning: boolean
  onSubmit: (drafts: Readonly<Record<string, AnswerDraft>>) => Promise<void>
}

/**
 * Alle offenen Fragen auf einmal. Beantwortet wird, was man weiß; ein Klick auf „Antworten übernehmen“
 * speichert alles und arbeitet es in den Blueprint ein. Unbeantwortete Fragen bleiben stehen.
 */
export function QuestionRound({
  round,
  blockedCount,
  analysisRunning,
  integrationRunning,
  onSubmit,
}: QuestionRoundProps) {
  const { t } = useTranslation()
  const [drafts, setDrafts] = useState<Record<string, CardDraft>>({})
  const [submitting, setSubmitting] = useState(false)
  const busy = submitting || analysisRunning || integrationRunning

  // Nur Entwürfe zu Fragen, die gerade angezeigt werden; alte IDs (nach neuer Analyse) zählen nicht.
  const answers = round.flatMap((question): [string, AnswerDraft][] => {
    const draft = drafts[question.id]
    const answer = draft ? toAnswerDraft(draft) : null
    return answer ? [[question.id, answer]] : []
  })
  const answeredCount = answers.filter(([, a]) => a.kind !== 'later').length
  const laterCount = answers.length - answeredCount
  const canSubmit = answers.length > 0 && !busy

  async function handleSubmit() {
    if (!canSubmit) return
    const sent = Object.fromEntries(answers)
    setSubmitting(true)
    try {
      await onSubmit(sent)
    } finally {
      setSubmitting(false)
      setDrafts((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([id]) => !(id in sent))),
      )
    }
  }

  // Strg/Cmd + Enter übernimmt die Antworten aus jedem Textfeld heraus.
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void handleSubmit()
    }
  }

  if (round.length === 0) {
    return (
      <section aria-labelledby="interview-round-heading" className="space-y-2">
        <h2 id="interview-round-heading" className="text-xl font-semibold">
          {t('interview.round.title')}
        </h2>
        <div className="space-y-2 rounded-lg border border-dashed p-4 text-sm">
          {analysisRunning ? (
            <p role="status" className="flex items-center gap-2">
              <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
              {t('interview.round.searching')}
            </p>
          ) : (
            <p>{t('interview.round.empty')}</p>
          )}
          {blockedCount > 0 && (
            <p className="text-muted-foreground">
              {t('interview.round.blocked', { count: blockedCount })}
            </p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="interview-round-heading"
      className="space-y-3"
      onKeyDown={handleKeyDown}
    >
      <div className="space-y-1">
        <h2 id="interview-round-heading" className="text-xl font-semibold">
          {t('interview.round.titleWithCount', { count: round.length })}
        </h2>
        <p className="text-sm text-muted-foreground">{t('interview.round.lead')}</p>
      </div>

      <ol className="space-y-3">
        {round.map((question) => (
          <li key={question.id}>
            <QuestionCard
              question={question}
              draft={drafts[question.id] ?? EMPTY_CARD_DRAFT}
              disabled={busy}
              onDraftChange={(draft) =>
                setDrafts((previous) => ({ ...previous, [question.id]: draft }))
              }
            />
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {integrationRunning
            ? t('interview.integration.running')
            : t('interview.round.progress', {
                answered: answeredCount,
                total: round.length,
                later: laterCount,
              })}
        </p>
        <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {t('interview.round.submit')}
        </Button>
      </div>
    </section>
  )
}
