import { ArrowRight, LoaderCircle } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Idea } from '@/core/ideation'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import type { IdeationController } from './useIdeation'

type IdeaCardProps = {
  idea: Idea
  selected: boolean
  /** Diese Idee wird gerade abgewandelt. */
  working: boolean
  /** Irgendeine Aktion läuft; alles ist gesperrt. */
  busy: boolean
  /** KI-Aktionen sind gesperrt (läuft etwas oder fehlt der Key). */
  disabled: boolean
  onSelectChange: (selected: boolean) => void
} & Pick<IdeationController, 'choose' | 'moreLike' | 'refine'>

/** Eine Idee mit Bewertung, Kernfunktionen und Aktionen zum Nehmen, Abwandeln und Kombinieren. */
export function IdeaCard({
  idea,
  selected,
  working,
  busy,
  disabled,
  onSelectChange,
  choose,
  moreLike,
  refine,
}: IdeaCardProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const customId = useId()
  const [note, setNote] = useState('')

  function handleCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!note.trim() || disabled) return
    void refine(idea, 'custom', note.trim())
    setNote('')
  }

  return (
    <article
      aria-labelledby={headingId}
      aria-busy={working}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors',
        selected && 'border-primary ring-1 ring-primary',
        working && 'opacity-60',
      )}
    >
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          {working && <LoaderCircle className="mt-1.5 size-4 shrink-0 animate-spin" aria-hidden />}
          <h3 id={headingId} className="flex-1 text-lg font-semibold break-words">
            {idea.title}
          </h3>
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={selected}
              disabled={disabled}
              onChange={(event) => onSelectChange(event.target.checked)}
              className="size-4 accent-primary"
            />
            {t('ideation.ideas.select')}
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-medium">
          <span className="rounded-full bg-muted px-2.5 py-0.5">
            {t(`ideation.ideas.effort.${idea.effort}`)}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-0.5">
            {t('ideation.ideas.novelty', { value: idea.novelty })}
          </span>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">
            {t('ideation.ideas.learning', { value: idea.learningValue })}
          </span>
        </div>
      </header>

      <p className="text-sm">{idea.pitch}</p>
      {idea.features.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground uppercase">
            {t('ideation.ideas.features')}
          </h4>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {idea.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
      )}
      {idea.learningNote && <p className="text-sm text-muted-foreground">{idea.learningNote}</p>}
      {idea.platform && <p className="text-xs text-muted-foreground">{idea.platform}</p>}

      <div className="mt-auto space-y-3 pt-1">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => void refine(idea, 'simpler')}
          >
            {t('ideation.ideas.simpler')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => void refine(idea, 'bolder')}
          >
            {t('ideation.ideas.bolder')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => void moreLike(idea)}
          >
            {t('ideation.ideas.moreLike')}
          </Button>
        </div>
        <form onSubmit={handleCustom} className="flex gap-2">
          <label htmlFor={customId} className="sr-only">
            {t('ideation.ideas.customLabel')}
          </label>
          <Input
            id={customId}
            value={note}
            disabled={disabled}
            placeholder={t('ideation.ideas.customPlaceholder')}
            onChange={(event) => setNote(event.target.value)}
            className="h-8"
          />
          <Button type="submit" size="sm" variant="outline" disabled={disabled || !note.trim()}>
            {t('ideation.ideas.customSubmit')}
          </Button>
        </form>
        <Button className="w-full" disabled={busy} onClick={() => void choose(idea)}>
          <ArrowRight className="size-4" aria-hidden />
          {t('ideation.ideas.choose')}
        </Button>
      </div>
    </article>
  )
}
