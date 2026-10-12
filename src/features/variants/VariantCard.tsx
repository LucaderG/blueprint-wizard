import { ArchiveRestore, ExternalLink, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useProjectRepository } from '@/app/useProjectRepository'
import { useSettings } from '@/app/useSettings'
import { computeCompleteness, trashExpiresAt, type Project } from '@/core/blueprint'
import { expandEntry, expandProfile } from '@/core/engine'
import { ProjectNotFoundError } from '@/core/storage'
import { useAiTask } from '@/features/ai/useAiTask'
import { ProfileView } from '@/features/blueprint/ProfileView'
import { CompletenessBar } from '@/features/projects/CompletenessBar'
import { remainingTime } from '@/features/projects/trashTime'
import { Button } from '@/shared/ui/button'

interface VariantCardProps {
  entry: Project
  now: Date
  onChange: (entry: Project) => void
  onError: () => void
}

/** Ein Steckbrief auf der Variantenseite mit „Speichern“, „Voll ausarbeiten“ und „Öffnen“. */
export function VariantCard({ entry, now, onChange, onError }: VariantCardProps) {
  const { t } = useTranslation()
  const repository = useProjectRepository()
  const { settings, aiProvider } = useSettings()
  const expansion = useAiTask()
  const headingId = `variant-${entry.id}`
  const saved = entry.library.status === 'saved'
  const expanding = expansion.state.status === 'running'
  const completeness = computeCompleteness(entry.blueprint).total
  const expiresAt = trashExpiresAt(entry.library, settings.trashRetentionDays)
  const remaining = expiresAt && remainingTime(expiresAt, now)

  async function save() {
    try {
      onChange(await repository.restore(entry.id))
    } catch {
      onError()
    }
  }

  function expand() {
    if (!aiProvider) return
    void expansion.run(async (signal) => {
      const { classification } = await expandProfile({
        provider: aiProvider,
        project: entry,
        language: settings.outputLanguage,
        signal,
      })
      // Neu laden, damit Änderungen aus einem anderen Tab nicht verloren gehen.
      const current = await repository.get(entry.id)
      if (!current) throw new ProjectNotFoundError(entry.id)
      await repository.save(expandEntry(current, classification).project)
      // Ausgearbeitetes soll nicht mit dem Papierkorb verfallen.
      return repository.restore(entry.id)
    }, onChange)
  }

  if (!entry.profile) return null

  return (
    <article
      aria-labelledby={headingId}
      className="flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <header className="space-y-1">
        <h2 id={headingId} className="text-lg font-semibold break-words">
          {entry.name}
        </h2>
        <p className="text-xs text-muted-foreground">
          {saved
            ? t('variants.status.saved')
            : remaining
              ? t('variants.status.trashed', {
                  remaining: t(`projects.trash.remaining.${remaining.unit}`, {
                    count: remaining.count,
                  }),
                })
              : t('variants.status.trashedNoDate')}
        </p>
      </header>

      <ProfileView profile={entry.profile} />

      {completeness > 0 && (
        <CompletenessBar
          value={completeness}
          label={t('projects.completenessLabel', { name: entry.name })}
        />
      )}

      {expansion.state.status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {t(expansion.state.errorKey)}
          {expansion.state.detail && (
            <span className="mt-1 block text-xs break-words opacity-80">
              {expansion.state.detail}
            </span>
          )}
        </p>
      )}
      {expanding && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('variants.expanding')}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={saved || expanding}
          aria-label={t('variants.saveLabel', { name: entry.name })}
          onClick={() => void save()}
        >
          <ArchiveRestore className="size-4" aria-hidden />
          {saved ? t('variants.savedButton') : t('variants.save')}
        </Button>
        {expanding ? (
          <Button type="button" size="sm" variant="outline" onClick={expansion.cancel}>
            {t('wizard.form.cancel')}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!aiProvider}
            aria-label={t('variants.expandLabel', { name: entry.name })}
            onClick={expand}
          >
            <Sparkles className="size-4" aria-hidden />
            {t('variants.expand')}
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link
            to={`/projekte/${entry.id}`}
            aria-label={t('variants.openLabel', { name: entry.name })}
          >
            <ExternalLink className="size-4" aria-hidden />
            {t('variants.open')}
          </Link>
        </Button>
      </div>
    </article>
  )
}
