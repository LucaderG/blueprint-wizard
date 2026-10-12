import { ArchiveRestore, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { trashExpiresAt } from '@/core/blueprint'
import type { ProjectSummary } from '@/core/storage'
import { Button } from '@/shared/ui/button'
import { remainingTime } from './trashTime'

interface TrashListProps {
  entries: ProjectSummary[]
  retentionDays: number
  now: Date
  onRestore: (entry: ProjectSummary) => void
  onDeleteForever: (entry: ProjectSummary) => void
  onEmpty: () => void
}

/** Papierkorb: Einträge nach Restzeit, mit „Speichern“ und „Endgültig löschen“. */
export function TrashList({
  entries,
  retentionDays,
  now,
  onRestore,
  onDeleteForever,
  onEmpty,
}: TrashListProps) {
  const { t } = useTranslation()

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
        {t('projects.trash.empty', { count: retentionDays })}
      </p>
    )
  }

  const expiry = (entry: ProjectSummary) =>
    trashExpiresAt(entry.library, retentionDays)?.getTime() ?? Infinity
  const sorted = [...entries].sort((a, b) => expiry(a) - expiry(b))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('projects.trash.intro', { count: retentionDays })}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onEmpty}>
          <Trash2 className="size-4" aria-hidden />
          {t('projects.trash.emptyAll')}
        </Button>
      </div>
      <ul className="space-y-3" aria-label={t('projects.trash.listLabel')}>
        {sorted.map((entry) => {
          const expiresAt = trashExpiresAt(entry.library, retentionDays)
          const remaining = expiresAt && remainingTime(expiresAt, now)
          return (
            <li
              key={entry.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <Link
                  to={`/projekte/${entry.id}`}
                  className="block font-semibold break-words hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {entry.name}
                </Link>
                {remaining && (
                  <p className="text-xs text-muted-foreground">
                    {t(`projects.trash.remaining.${remaining.unit}`, { count: remaining.count })}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('projects.trash.restoreLabel', { name: entry.name })}
                  onClick={() => onRestore(entry)}
                >
                  <ArchiveRestore className="size-4" aria-hidden />
                  {t('projects.trash.restore')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  aria-label={t('projects.trash.deleteForeverLabel', { name: entry.name })}
                  onClick={() => onDeleteForever(entry)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t('projects.trash.deleteForever')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
