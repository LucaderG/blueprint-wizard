import { Combine, Dices, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { IdeaCard } from './IdeaCard'
import type { IdeationController } from './useIdeation'

type IdeaListProps = Pick<
  IdeationController,
  | 'session'
  | 'activity'
  | 'busyIdeaId'
  | 'hasAi'
  | 'generate'
  | 'combine'
  | 'choose'
  | 'save'
  | 'entryStatus'
  | 'moreLike'
  | 'refine'
  | 'editProfile'
>

/** Die vorgeschlagenen Ideen mit Neu würfeln, Kombinieren und Zurück zum Fragebogen. */
export function IdeaList({
  session,
  activity,
  busyIdeaId,
  hasAi,
  generate,
  combine,
  choose,
  save,
  entryStatus,
  moreLike,
  refine,
  editProfile,
}: IdeaListProps) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const busy = activity !== null
  const aiDisabled = busy || !hasAi

  // Nur ausgewählte Ideen, die es noch gibt (nach Neu würfeln oder Abwandeln).
  const selected = session.ideas.filter((idea) => selectedIds.includes(idea.id))
  const [first, second] = selected

  function toggle(id: string, on: boolean) {
    setSelectedIds((current) => {
      const alive = current.filter((x) => session.ideas.some((idea) => idea.id === x))
      if (!on) return alive.filter((x) => x !== id)
      // Höchstens zwei: die älteste Auswahl fällt heraus.
      return [...alive.filter((x) => x !== id), id].slice(-2)
    })
  }

  function handleCombine() {
    if (!first || !second) return
    setSelectedIds([])
    void combine(first, second)
  }

  return (
    <section aria-labelledby="ideation-ideas-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id="ideation-ideas-heading" className="text-xl font-semibold">
            {t('ideation.ideas.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('ideation.ideas.lead')}</p>
          <p className="text-sm text-muted-foreground">{t('ideation.ideas.trashHint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={editProfile}>
            <Pencil className="size-4" aria-hidden />
            {t('ideation.ideas.editProfile')}
          </Button>
          <Button variant="outline" size="sm" disabled={aiDisabled} onClick={() => void generate()}>
            <Dices className="size-4" aria-hidden />
            {t('ideation.ideas.reroll')}
          </Button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <p aria-live="polite">
            {selected.length < 2
              ? t('ideation.ideas.combineHint', { count: selected.length })
              : `${first?.title} + ${second?.title}`}
          </p>
          <Button size="sm" disabled={selected.length < 2 || aiDisabled} onClick={handleCombine}>
            <Combine className="size-4" aria-hidden />
            {t('ideation.ideas.combine')}
          </Button>
        </div>
      )}

      <ol className="grid gap-4 md:grid-cols-2">
        {session.ideas.map((idea) => (
          <li key={idea.id} className="flex">
            <div className="flex w-full flex-col [&>article]:flex-1">
              <IdeaCard
                idea={idea}
                selected={selectedIds.includes(idea.id)}
                working={busyIdeaId === idea.id}
                busy={busy}
                disabled={aiDisabled}
                onSelectChange={(on) => toggle(idea.id, on)}
                status={entryStatus(idea)}
                save={save}
                choose={choose}
                moreLike={moreLike}
                refine={refine}
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
