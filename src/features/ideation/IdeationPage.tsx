import { useTranslation } from 'react-i18next'
import { ApiKeyNotice } from '@/features/settings/ApiKeyNotice'
import { IdeaList } from './IdeaList'
import { IdeationStatus } from './IdeationStatus'
import { Questionnaire } from './Questionnaire'
import { useIdeation } from './useIdeation'

/** Einstieg „Ich habe keine Idee“: Fragebogen → Ideen → gewählte Idee startet das Projekt. */
export function IdeationPage() {
  const { t } = useTranslation()
  const ideation = useIdeation()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('wizard.entries.noIdea.title')}</h1>
        <p className="text-muted-foreground">{t('wizard.entries.noIdea.intro')}</p>
      </header>

      <ApiKeyNotice />
      <IdeationStatus {...ideation} />
      {ideation.view === 'ideas' && ideation.session.ideas.length > 0 ? (
        <IdeaList {...ideation} />
      ) : (
        <Questionnaire {...ideation} />
      )}
    </div>
  )
}
