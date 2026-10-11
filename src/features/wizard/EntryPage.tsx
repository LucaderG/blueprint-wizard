import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { NotFoundPage } from '@/app/NotFoundPage'
import { ApiKeyNotice } from '@/features/settings/ApiKeyNotice'
import { entryPointFromSlug } from './entryPoints'
import { IdeaForm } from './IdeaForm'

/** Startseite eines Einstiegspunkts: Erklärung, Hinweis zum Key und das Eingabeformular. */
export function EntryPage() {
  const { t } = useTranslation()
  const { entryPoint: slug = '' } = useParams()
  const entryPoint = entryPointFromSlug(slug)
  if (!entryPoint) return <NotFoundPage />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {t(`wizard.entries.${entryPoint}.title`)}
        </h1>
        <p className="text-muted-foreground">{t(`wizard.entries.${entryPoint}.intro`)}</p>
      </header>

      <ApiKeyNotice />
      <IdeaForm key={entryPoint} entryPoint={entryPoint} />
    </div>
  )
}
