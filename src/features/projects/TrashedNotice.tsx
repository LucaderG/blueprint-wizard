import { ArchiveRestore } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectRepository } from '@/app/useProjectRepository'
import { useSettings } from '@/app/useSettings'
import { trashExpiresAt, type Project } from '@/core/blueprint'
import { Button } from '@/shared/ui/button'
import { remainingTime } from './trashTime'

/**
 * Hinweis auf der Projektseite, solange der Eintrag im Papierkorb liegt (z. B. eine geöffnete
 * Variante). „Speichern“ holt ihn in die Bibliothek; das automatische Speichern ändert den Status nie.
 */
export function TrashedNotice({ project }: { project: Project }) {
  const { t } = useTranslation()
  const repository = useProjectRepository()
  const { settings } = useSettings()
  const [state, setState] = useState<'trashed' | 'saved' | 'error'>('trashed')

  if (project.library.status !== 'trashed') return null

  if (state === 'saved') {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t('projects.trashedNotice.saved')}
      </p>
    )
  }

  const expiresAt = trashExpiresAt(project.library, settings.trashRetentionDays)
  const remaining = expiresAt && remainingTime(expiresAt, new Date())

  async function save() {
    try {
      await repository.restore(project.id)
      setState('saved')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <p className="text-sm">
        {remaining
          ? t('projects.trashedNotice.text', {
              remaining: t(`projects.trash.remaining.${remaining.unit}`, {
                count: remaining.count,
              }),
            })
          : t('projects.trashedNotice.textNoDate')}
      </p>
      <Button type="button" size="sm" onClick={() => void save()}>
        <ArchiveRestore className="size-4" aria-hidden />
        {t('projects.trashedNotice.save')}
      </Button>
      {state === 'error' && (
        <p role="alert" className="w-full text-sm text-destructive">
          {t('projects.errors.generic')}
        </p>
      )}
    </div>
  )
}
