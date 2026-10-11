import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Question } from '@/core/blueprint'
import { Button } from '@/shared/ui/button'
import { QuestionCard } from './QuestionCard'
import { isAnswered, type AnswerDraft } from './useInterview'

interface QuestionRoundProps {
  round: Question[]
  /** Anzahl der Fragen, die noch auf andere Antworten warten. */
  blockedCount: number
  analysisRunning: boolean
  onSubmit: (drafts: Readonly<Record<string, AnswerDraft>>) => Promise<void>
}

/** Die aktuelle Fragerunde (1–3 Fragen) mit lokalen Entwürfen, bis sie gespeichert werden. */
export function QuestionRound({
  round,
  blockedCount,
  analysisRunning,
  onSubmit,
}: QuestionRoundProps) {
  const { t } = useTranslation()
  // Entwürfe nach Frage-ID. Die ID-Liste ist ein String, damit der Effekt nur bei echten Änderungen läuft.
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({})
  const [submitting, setSubmitting] = useState(false)
  const roundKey = round.map((q) => q.id).join(',')
  const [draftsRoundKey, setDraftsRoundKey] = useState(roundKey)

  // Entwürfe für Fragen verwerfen, die nicht mehr in der Runde stehen. Die Anpassung passiert beim
  // Rendern (React-Muster für abgeleiteten State), nicht in einem Effekt.
  if (draftsRoundKey !== roundKey) {
    const ids = new Set(roundKey.split(','))
    setDraftsRoundKey(roundKey)
    setDrafts((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([id]) => ids.has(id))),
    )
  }

  const setDraft = (questionId: string, draft: AnswerDraft | undefined) =>
    setDrafts((previous) => {
      const next = { ...previous }
      if (draft) next[questionId] = draft
      else delete next[questionId]
      return next
    })

  // Nur Entwürfe, die eine Antwort oder „Später“ enthalten, und nur Fragen dieser Runde.
  const sendable = round.flatMap((question): [string, AnswerDraft][] => {
    const draft = drafts[question.id]
    return draft && (isAnswered(draft) || draft.kind === 'later') ? [[question.id, draft]] : []
  })
  const canSubmit = sendable.length > 0 && !analysisRunning && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    const sent = Object.fromEntries(sendable)
    setSubmitting(true)
    try {
      await onSubmit(sent)
    } finally {
      setSubmitting(false)
      setDrafts((previous) => {
        const next = { ...previous }
        for (const id of Object.keys(sent)) delete next[id]
        return next
      })
    }
  }

  return (
    <section aria-labelledby="interview-round-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="interview-round-heading" className="text-xl font-semibold">
          {t('interview.round.title')}
        </h2>
        {round.length > 0 && (
          <p className="text-sm text-muted-foreground">{t('interview.round.lead')}</p>
        )}
      </div>

      {round.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed p-4 text-sm">
          <p>{t('interview.round.empty')}</p>
          {blockedCount > 0 && (
            <>
              <p className="font-medium">{t('interview.round.blocked', { count: blockedCount })}</p>
              <p className="text-muted-foreground">{t('interview.round.blockedHint')}</p>
            </>
          )}
        </div>
      ) : (
        <>
          <ol className="space-y-3">
            {round.map((question) => (
              <li key={question.id}>
                <QuestionCard
                  question={question}
                  draft={drafts[question.id]}
                  onDraftChange={(draft) => setDraft(question.id, draft)}
                />
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {analysisRunning && (
              <p className="text-sm text-muted-foreground">
                {t('interview.round.analysisRunning')}
              </p>
            )}
            <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
              {t('interview.round.save')}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
