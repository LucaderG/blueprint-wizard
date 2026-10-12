import { Check, CircleCheck, Plus } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Monetization, Project, SectionId } from '@/core/blueprint'
import { canFinalize, hasImpactNote, type MonetizationImpact } from '@/core/engine'
import { resources, type UiLanguage } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'

interface FinishStepProps {
  project: Project
  monetization: Monetization
  impacts: MonetizationImpact[]
  onFinalize: () => void
  onReopen: () => void
  onApplyImpact: (sectionId: SectionId, text: string) => void
}

/** Schritt 3: abschließen und Auswirkungen auf andere Abschnitte übernehmen. */
export function FinishStep({
  project,
  monetization,
  impacts,
  onFinalize,
  onReopen,
  onApplyImpact,
}: FinishStepProps) {
  const { t, i18n } = useTranslation()
  const headingId = useId()
  const impactsId = useId()
  // Ein Hinweis gilt auch dann als übernommen, wenn er in einer anderen UI-Sprache angehängt wurde.
  const isApplied = (code: MonetizationImpact['code'], sectionId: SectionId) =>
    (Object.keys(resources) as UiLanguage[]).some((language) =>
      hasImpactNote(
        project,
        sectionId,
        i18n.getFixedT(language)(`monetization.impacts.items.${code}`),
      ),
    )
  const decided = monetization.status === 'decided'

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-1">
        <h2 id={headingId} className="text-xl font-semibold">
          {t('monetization.finish.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('monetization.finish.intro')}</p>
      </div>

      {decided ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p role="status" className="flex items-center gap-2 text-sm font-medium">
            <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
            {t('monetization.finish.decided', {
              date: formatDateTime(monetization.decidedAt ?? ''),
            })}
          </p>
          <Button variant="outline" size="sm" onClick={onReopen}>
            {t('monetization.finish.reopen')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {canFinalize(monetization)
              ? t('monetization.finish.ready')
              : t('monetization.finish.incomplete')}
          </p>
          <Button size="sm" disabled={!canFinalize(monetization)} onClick={onFinalize}>
            <Check className="size-4" aria-hidden />
            {t('monetization.finish.finalize')}
          </Button>
        </div>
      )}

      {impacts.length > 0 && (
        <div className="space-y-2">
          <h3 id={impactsId} className="font-semibold">
            {t('monetization.impacts.title')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('monetization.impacts.intro')}</p>
          <ul aria-labelledby={impactsId} className="space-y-2">
            {impacts.map(({ code, sectionId }) => {
              const text = t(`monetization.impacts.items.${code}`)
              const applied = isApplied(code, sectionId)
              return (
                <li
                  key={code}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <span className="min-w-0 flex-1 break-words">
                    <span className="mr-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {t(`sections.${sectionId}`)}
                    </span>
                    {text}
                  </span>
                  {applied ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="size-3.5" aria-hidden />
                      {t('monetization.impacts.applied')}
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApplyImpact(sectionId, text)}
                      aria-label={t('monetization.impacts.applyTo', {
                        section: t(`sections.${sectionId}`),
                        text,
                      })}
                    >
                      <Plus className="size-4" aria-hidden />
                      {t('monetization.impacts.apply')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
