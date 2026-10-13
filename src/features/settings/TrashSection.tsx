import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectRepository } from '@/app/useProjectRepository'
import { useSettings } from '@/app/useSettings'
import { isTrashExpired, TRASH_RETENTION_DAYS, type Library } from '@/core/blueprint'
import { Select } from '@/shared/ui/select'
import { SettingsSection } from './SettingsSection'

/** Aufbewahrungsfrist des Papierkorbs. Wirkt sofort; der Hinweis nennt, was dadurch abläuft. */
export function TrashSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const repository = useProjectRepository()
  const selectId = useId()
  const hintId = useId()
  const [trashed, setTrashed] = useState<Library[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    repository.list({ status: 'trashed' }).then(
      (summaries) => active && setTrashed(summaries.map((s) => s.library)),
      () => {
        // Ohne Liste fehlt nur der Hinweis auf ablaufende Einträge.
      },
    )
    return () => {
      active = false
    }
  }, [repository])

  const now = new Date()
  const expiring = trashed.filter((library) =>
    isTrashExpired(library, now, settings.trashRetentionDays),
  ).length

  function handleChange(value: string) {
    const days = TRASH_RETENTION_DAYS.find((d) => String(d) === value)
    if (days === undefined) return
    update({ trashRetentionDays: days })
    setSaved(true)
  }

  return (
    <SettingsSection title={t('settings.trash.title')} description={t('settings.trash.intro')}>
      <div className="space-y-1.5">
        <label htmlFor={selectId} className="block text-sm font-medium">
          {t('settings.trash.retentionLabel')}
        </label>
        <Select
          id={selectId}
          value={String(settings.trashRetentionDays)}
          onChange={(event) => handleChange(event.target.value)}
          aria-describedby={hintId}
          className="max-w-xs"
        >
          {TRASH_RETENTION_DAYS.map((days) => (
            <option key={days} value={days}>
              {t('settings.trash.days', { count: days })}
            </option>
          ))}
        </Select>
        <p id={hintId} className="text-xs text-muted-foreground">
          {t('settings.trash.hint')}
        </p>
      </div>

      {expiring > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t('settings.trash.expiring', { count: expiring })}
        </p>
      )}

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {saved && t('settings.saved')}
      </p>
    </SettingsSection>
  )
}
