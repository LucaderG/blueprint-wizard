import { useTranslation } from 'react-i18next'
import type { ProjectProfile } from '@/core/blueprint'

interface ProfileViewProps {
  profile: ProjectProfile
}

/** Schreibgeschützte Darstellung eines Steckbriefs. Leere Felder und Listen werden weggelassen. */
export function ProfileView({ profile }: ProfileViewProps) {
  const { t } = useTranslation()
  const { monetization } = profile
  const hasMonetization =
    monetization.model !== '' || monetization.priceRange !== '' || monetization.reason !== ''

  const fields: Array<{ key: string; label: string; value: string }> = [
    { key: 'problem', label: t('profile.fields.problem'), value: profile.problem },
    { key: 'audience', label: t('profile.fields.audience'), value: profile.audience },
    { key: 'platform', label: t('profile.fields.platform'), value: profile.platform },
    {
      key: 'effort',
      label: t('profile.fields.effort'),
      value: t(`profile.effort.${profile.effort}`),
    },
  ].filter((field) => field.value.trim() !== '')

  return (
    <div className="space-y-4">
      <p className="text-sm break-words whitespace-pre-wrap">{profile.pitch}</p>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
            <dd className="break-words whitespace-pre-wrap">{field.value}</dd>
          </div>
        ))}

        {hasMonetization && (
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">
              {t('profile.monetization')}
            </dt>
            <dd className="space-y-2">
              <dl className="grid gap-2 sm:grid-cols-2">
                {monetization.model !== '' && (
                  <div className="space-y-0.5">
                    <dt className="text-xs text-muted-foreground">
                      {t('profile.fields.monetizationModel')}
                    </dt>
                    <dd className="break-words">{monetization.model}</dd>
                  </div>
                )}
                {monetization.priceRange !== '' && (
                  <div className="space-y-0.5">
                    <dt className="text-xs text-muted-foreground">
                      {t('profile.fields.priceRange')}
                    </dt>
                    <dd className="break-words">{monetization.priceRange}</dd>
                  </div>
                )}
                {monetization.reason !== '' && (
                  <div className="space-y-0.5 sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">{t('profile.fields.reason')}</dt>
                    <dd className="break-words whitespace-pre-wrap">{monetization.reason}</dd>
                  </div>
                )}
              </dl>
              <p className="text-xs text-muted-foreground">{t('profile.priceAssumption')}</p>
            </dd>
          </div>
        )}

        {profile.features.length > 0 && (
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">
              {t('profile.fields.features')}
            </dt>
            <dd>
              <ul className="list-disc space-y-1 pl-5">
                {profile.features.map((feature, index) => (
                  <li key={index} className="break-words">
                    {feature}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}

        {profile.risks.length > 0 && (
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">
              {t('profile.fields.risks')}
            </dt>
            <dd>
              <ul className="list-disc space-y-1 pl-5">
                {profile.risks.map((risk, index) => (
                  <li key={index} className="break-words">
                    {risk}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
