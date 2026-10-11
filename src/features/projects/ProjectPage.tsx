import { ArrowLeft, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { computeCompleteness, SECTION_IDS, type Maturity } from '@/core/blueprint'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { CompletenessBar } from './CompletenessBar'
import { useProject } from './useProject'

const MATURITY_STYLES: Record<Maturity, string> = {
  empty: 'bg-muted text-muted-foreground',
  vague: 'border border-primary/40 text-primary',
  decided: 'bg-primary text-primary-foreground',
}

function MaturityBadge({ maturity }: { maturity: Maturity }) {
  const { t } = useTranslation()
  const label = t(`maturity.${maturity}`)
  return (
    <>
      <span
        aria-hidden
        className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', MATURITY_STYLES[maturity])}
      >
        {label}
      </span>
      <span className="sr-only">{t('projects.page.maturityLabel', { maturity: label })}</span>
    </>
  )
}

/** Übersicht eines Projekts. Bearbeiten der Abschnitte folgt in einer späteren Phase. */
export function ProjectPage() {
  const { t } = useTranslation()
  const { projectId = '' } = useParams()
  const state = useProject(projectId)

  if (state.status === 'loading') {
    return <p className="text-muted-foreground">{t('projects.page.loading')}</p>
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-destructive">
        {t('projects.page.loadError')}
      </p>
    )
  }

  if (state.status === 'notFound') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">{t('projects.page.notFoundTitle')}</h1>
        <p className="text-muted-foreground">{t('projects.page.notFoundText')}</p>
        <Button asChild>
          <Link to="/">{t('projects.page.home')}</Link>
        </Button>
      </div>
    )
  }

  const { project } = state
  const completeness = computeCompleteness(project.blueprint)

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('projects.page.back')}
      </Link>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight break-words">{project.name}</h1>
        <CompletenessBar value={completeness.total} label={t('projects.page.completenessLabel')} />
      </header>

      <p className="flex gap-2 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('projects.page.editingHint')}
      </p>

      <section aria-labelledby="sections-heading" className="space-y-3">
        <h2 id="sections-heading" className="text-xl font-semibold">
          {t('projects.page.sectionsTitle')}
        </h2>
        <ol
          aria-labelledby="sections-heading"
          className="divide-y divide-border rounded-lg border border-border bg-card text-card-foreground"
        >
          {SECTION_IDS.map((id) => (
            <li key={id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>{t(`sections.${id}`)}</span>
              <MaturityBadge maturity={project.blueprint.sections[id].maturity} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
