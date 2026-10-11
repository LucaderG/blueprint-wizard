import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Question } from '@/core/blueprint'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import type { AnswerDraft } from './useInterview'

type LeverageLevel = 'foundation' | 'important' | 'detail'

/** Hebel 4–5 gilt als Grundsatzfrage, 3 als wichtig, 1–2 als Detail. */
function leverageLevel(leverage: number): LeverageLevel {
  if (leverage >= 4) return 'foundation'
  if (leverage === 3) return 'important'
  return 'detail'
}

const LEVERAGE_CLASS: Record<LeverageLevel, string> = {
  foundation: 'bg-primary/10 text-primary',
  important: 'bg-muted text-foreground',
  detail: 'bg-muted text-muted-foreground',
}

interface QuestionCardProps {
  question: Question
  draft: AnswerDraft | undefined
  onDraftChange: (draft: AnswerDraft | undefined) => void
}

/** Eine Frage mit Optionen, optionaler Ergänzung, Freitext und „Später“. */
export function QuestionCard({ question, draft, onDraftChange }: QuestionCardProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const helpId = useId()
  const groupName = useId()
  const noteId = useId()
  const textId = useId()

  const level = leverageLevel(question.leverage)
  const selectedOptionId = draft?.kind === 'option' ? draft.optionId : null
  const note = draft?.kind === 'option' ? draft.note : ''
  const text = draft?.kind === 'text' ? draft.text : ''
  const later = draft?.kind === 'later'

  return (
    <article aria-labelledby={headingId} className="space-y-4 rounded-lg border bg-card p-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {t(`sections.${question.sectionId}`)}
          </span>
          <span
            className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', LEVERAGE_CLASS[level])}
          >
            {t(`interview.question.leverage.${level}`)}
          </span>
        </div>
        <h3 id={headingId} className="text-lg font-semibold break-words">
          {question.text}
        </h3>
        {question.why && (
          <p id={helpId} className="text-sm text-muted-foreground">
            {question.why}
          </p>
        )}
      </header>

      {question.options.length > 0 && (
        <fieldset className="space-y-2" aria-describedby={question.why ? helpId : undefined}>
          <legend className="mb-2 text-sm font-medium">
            {t('interview.question.optionsLegend')}
          </legend>
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name={groupName}
                value={option.id}
                checked={selectedOptionId === option.id}
                onChange={() => onDraftChange({ kind: 'option', optionId: option.id, note: note })}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="leading-relaxed">{option.label}</span>
            </label>
          ))}
        </fieldset>
      )}

      {selectedOptionId !== null && (
        <div className="space-y-1.5">
          <label htmlFor={noteId} className="text-sm font-medium">
            {t('interview.question.noteLabel')}
          </label>
          <Input
            id={noteId}
            value={note}
            onChange={(event) =>
              onDraftChange({
                kind: 'option',
                optionId: selectedOptionId,
                note: event.target.value,
              })
            }
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={textId} className="text-sm font-medium">
          {t('interview.question.textLabel')}
        </label>
        <textarea
          id={textId}
          rows={3}
          value={text}
          onChange={(event) =>
            onDraftChange(
              event.target.value === '' ? undefined : { kind: 'text', text: event.target.value },
            )
          }
          className="w-full rounded-md border border-border bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={later}
          className={cn(later && 'border-primary bg-primary/5 text-primary')}
          onClick={() => onDraftChange(later ? undefined : { kind: 'later' })}
        >
          {t('interview.round.later')}
        </Button>
      </div>
    </article>
  )
}
