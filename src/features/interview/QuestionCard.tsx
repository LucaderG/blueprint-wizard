import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Question } from '@/core/blueprint'
import { cn } from '@/shared/lib/utils'
import { EMPTY_CARD_DRAFT, toAnswerDraft, type CardDraft } from './cardDraft'

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
  draft: CardDraft
  disabled: boolean
  onDraftChange: (draft: CardDraft) => void
}

/**
 * Kompakte Frage: Optionen zum Antippen (erneutes Antippen hebt die Wahl auf), ein Textfeld für eine
 * eigene Antwort oder Ergänzung und „Später“.
 */
export function QuestionCard({ question, draft, disabled, onDraftChange }: QuestionCardProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const helpId = useId()
  const groupName = useId()
  const textId = useId()

  const level = leverageLevel(question.leverage)
  const hasOptions = question.options.length > 0
  const answered = toAnswerDraft(draft) !== null && !draft.later

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        // Abstand nach unten, damit die feste Fußleiste der Runde fokussierte Karten nicht verdeckt.
        'scroll-mb-24 space-y-3 rounded-lg border bg-card p-4 transition-colors',
        answered && 'border-primary/50',
        draft.later && 'opacity-60',
      )}
    >
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {t(`sections.${question.sectionId}`)}
          </span>
          <span
            className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', LEVERAGE_CLASS[level])}
          >
            {t(`interview.question.leverage.${level}`)}
          </span>
          <button
            type="button"
            aria-pressed={draft.later}
            disabled={disabled}
            onClick={() => onDraftChange({ ...EMPTY_CARD_DRAFT, later: !draft.later })}
            className={cn(
              'ml-auto rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50',
              draft.later && 'bg-muted text-foreground',
            )}
          >
            {t('interview.round.later')}
          </button>
        </div>
        <h3 id={headingId} className="font-semibold break-words">
          {question.text}
        </h3>
        {question.why && (
          <p id={helpId} className="text-sm text-muted-foreground">
            {question.why}
          </p>
        )}
      </header>

      {!draft.later && (
        <>
          {hasOptions && (
            <fieldset
              disabled={disabled}
              aria-describedby={question.why ? helpId : undefined}
              className="flex flex-wrap gap-2"
            >
              <legend className="sr-only">{t('interview.question.optionsLegend')}</legend>
              {question.options.map((option) => {
                const checked = draft.optionId === option.id
                return (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                  >
                    <input
                      type="radio"
                      name={groupName}
                      value={option.id}
                      checked={checked}
                      onChange={() => onDraftChange({ ...draft, optionId: option.id })}
                      // Erneutes Antippen der gewählten Option hebt die Wahl wieder auf.
                      onClick={() => checked && onDraftChange({ ...draft, optionId: null })}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                )
              })}
            </fieldset>
          )}

          <div>
            <label htmlFor={textId} className="sr-only">
              {hasOptions ? t('interview.question.noteLabel') : t('interview.question.textLabel')}
            </label>
            <textarea
              id={textId}
              rows={hasOptions ? 1 : 2}
              disabled={disabled}
              value={draft.text}
              placeholder={
                hasOptions
                  ? t('interview.question.notePlaceholder')
                  : t('interview.question.textPlaceholder')
              }
              onChange={(event) => onDraftChange({ ...draft, text: event.target.value })}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            />
          </div>
        </>
      )}
    </article>
  )
}
