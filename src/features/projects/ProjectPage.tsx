import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { BlueprintOverview } from '@/features/blueprint/BlueprintOverview'
import { Button } from '@/shared/ui/button'
import { TrashedNotice } from './TrashedNotice'
import { useProjectEditor } from './useProjectEditor'

/** Projektseite: lädt das Projekt und zeigt die bearbeitbare Blueprint-Übersicht. */
export function ProjectPage() {
  const { t } = useTranslation()
  const { projectId = '' } = useParams()
  const state = useProjectEditor(projectId)

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

  return (
    <div className="space-y-6">
      <TrashedNotice project={state.project} />
      <BlueprintOverview {...state} />
    </div>
  )
}
