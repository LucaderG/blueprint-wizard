import { Check, Pencil, Sparkles, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Maturity, Section, SectionId } from '@/core/blueprint'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { MaturityBadge } from './MaturityBadge'
import { MATURITY_OPTIONS } from './maturity'

interface SectionCardProps {
  section: Section
  onContentChange: (content: string) => void
  onMaturityChange: (maturity: Maturity) => void
  onAcceptSuggestion: () => void
}

/** Ein Abschnitt des Blueprints: Inhalt, Reifegrad und Bearbeitung. */
export function SectionCard({
  section,
  onContentChange,
  onMaturityChange,
  onAcceptSuggestion,
}: SectionCardProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const id: SectionId = section.id
  const title = t(`sections.${id}`)
  // `null` heißt: nicht im Bearbeitungsmodus. Sonst ist es der ungespeicherte Entwurf.
  const [draft, setDraft] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const editing = draft !== null
  const hasContent = section.content.trim() !== ''

  useEffect(() => {
    const textarea = textareaRef.current
    if (!editing || !textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [editing])

  const finish = () => {
    setDraft(null)
    editButtonRef.current?.focus()
  }

  const apply = () => {
    if (draft !== null && draft !== section.content) onContentChange(draft)
    finish()
  }

  const onTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      finish()
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      apply()
    }
  }

  return (
    <article
      aria-labelledby={titleId}
      className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={titleId} className="text-base font-semibold break-words">
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {section.source === 'aiSuggestion' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Sparkles className="size-3" aria-hidden />
              {t('blueprint.section.suggestion')}
            </span>
          )}
          {section.source === 'aiAccepted' && (
            <span className="text-xs text-muted-foreground">{t('blueprint.section.accepted')}</span>
          )}
          <MaturityBadge maturity={section.maturity} />
        </div>
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          aria-label={title}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onTextareaKeyDown}
          rows={6}
          className="w-full resize-y rounded-md border border-border bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      ) : hasContent ? (
        <p className="text-sm break-words whitespace-pre-wrap">{section.content}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">{t('blueprint.section.placeholder')}</p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <MaturitySelector
          name={`maturity-${id}`}
          value={section.maturity}
          hasContent={hasContent}
          onChange={onMaturityChange}
        />

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={apply}>
                <Check className="size-4" aria-hidden />
                {t('blueprint.section.done')}
              </Button>
              <Button variant="outline" size="sm" onClick={finish}>
                <X className="size-4" aria-hidden />
                {t('blueprint.section.cancel')}
              </Button>
            </>
          ) : (
            <>
              {section.source === 'aiSuggestion' && (
                <Button size="sm" onClick={onAcceptSuggestion}>
                  <Check className="size-4" aria-hidden />
                  {t('blueprint.section.accept')}
                </Button>
              )}
              <Button
                ref={editButtonRef}
                variant="outline"
                size="sm"
                onClick={() => setDraft(section.content)}
              >
                <Pencil className="size-4" aria-hidden />
                {t('blueprint.section.edit')}
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}

interface MaturitySelectorProps {
  name: string
  value: Maturity
  hasContent: boolean
  onChange: (maturity: Maturity) => void
}

/** Segmentierte Auswahl für den Reifegrad. Ohne Inhalt sind nur „leer“ und ein Hinweis verfügbar. */
function MaturitySelector({ name, value, hasContent, onChange }: MaturitySelectorProps) {
  const { t } = useTranslation()
  const hintId = useId()

  return (
    <fieldset aria-describedby={hasContent ? undefined : hintId} className="space-y-1.5">
      <legend className="text-xs font-medium text-muted-foreground">
        {t('blueprint.section.maturityLabel')}
      </legend>
      <div className="inline-flex rounded-md border border-border p-0.5">
        {MATURITY_OPTIONS.map((maturity) => {
          const disabled = !hasContent && maturity !== 'empty'
          return (
            <label key={maturity} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={maturity}
                checked={value === maturity}
                disabled={disabled}
                onChange={() => onChange(maturity)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'inline-block rounded px-3 py-1 text-sm whitespace-nowrap transition-colors',
                  'peer-checked:bg-primary peer-checked:text-primary-foreground',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                  'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
                  value !== maturity && 'hover:bg-muted',
                )}
              >
                {t(`maturity.${maturity}`)}
              </span>
            </label>
          )
        })}
      </div>
      {!hasContent && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {t('blueprint.section.needsContent')}
        </p>
      )}
    </fieldset>
  )
}
