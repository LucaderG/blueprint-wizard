import { Lightbulb, ListChecks, PenLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ProjectsSection } from '@/features/projects/ProjectsSection'

const entryPoints = [
  { key: 'noIdea', icon: Lightbulb },
  { key: 'partialIdea', icon: PenLine },
  { key: 'almostDone', icon: ListChecks },
] as const

export function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('home.title')}</h1>
        <p className="text-muted-foreground">{t('home.subtitle')}</p>
      </section>

      <ul className="grid gap-4 sm:grid-cols-3" aria-label={t('home.entryPointsLabel')}>
        {entryPoints.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="rounded-lg border border-border bg-card p-5 text-card-foreground"
          >
            <Icon className="mb-3 size-6 text-primary" aria-hidden />
            <h2 className="font-semibold">{t(`home.entry.${key}.title`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`home.entry.${key}.description`)}
            </p>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted-foreground">{t('home.comingSoon')}</p>

      <ProjectsSection />
    </div>
  )
}
