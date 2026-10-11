import { Plus, X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { addTags, hasTag, removeTag, toggleTag } from '@/core/ideation'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

interface TagFieldProps {
  label: string
  hint?: string
  tags: string[]
  suggestions: string[]
  disabled: boolean
  onChange: (tags: string[]) => void
}

/** Schlagwörter: Vorschläge zum Antippen und ein Feld für eigene (Enter oder Komma trennt). */
export function TagField({ label, hint, tags, suggestions, disabled, onChange }: TagFieldProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const labelId = useId()
  const hintId = useId()
  const inputId = useId()
  const custom = tags.filter((tag) => !suggestions.some((s) => hasTag([s], tag)))

  function commit() {
    if (!input.trim()) return
    onChange(addTags(tags, input))
    setInput('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    }
  }

  return (
    <fieldset
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      disabled={disabled}
      className="space-y-2"
    >
      <legend id={labelId} className="text-sm font-medium">
        {label}
      </legend>
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('ideation.questionnaire.suggestionsLabel')}
      >
        {suggestions.map((suggestion) => {
          const active = hasTag(tags, suggestion)
          return (
            <button
              key={suggestion}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(toggleTag(tags, suggestion))}
              className={cn(
                'rounded-full border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50',
                active && 'border-primary bg-primary/10 text-primary hover:bg-primary/15',
              )}
            >
              {suggestion}
            </button>
          )
        })}
        {custom.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 py-1 pr-1 pl-3 text-sm text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(removeTag(tags, tag))}
              aria-label={t('ideation.questionnaire.tagRemove', { tag })}
              className="rounded-full p-0.5 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t('ideation.questionnaire.tagInputLabel', { field: label })}
        </label>
        <Input
          id={inputId}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          className="max-w-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={commit}
          disabled={!input.trim()}
        >
          <Plus className="size-4" aria-hidden />
          {t('ideation.questionnaire.tagAdd')}
        </Button>
      </div>
    </fieldset>
  )
}
