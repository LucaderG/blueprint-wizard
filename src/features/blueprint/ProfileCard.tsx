import { Check, Pencil, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PROFILE_EFFORTS, type ProfileEffort, type ProjectProfile } from '@/core/blueprint'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { ProfileView } from './ProfileView'

interface ProfileCardProps {
  profile: ProjectProfile
  onChange: (profile: ProjectProfile) => void
}

/** Steckbrief eines Projekts: Lesemodus mit Bearbeitungsformular. */
export function ProfileCard({ profile, onChange }: ProfileCardProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const [editing, setEditing] = useState(false)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  // Nach Übernehmen oder Abbrechen soll der Fokus zurück auf den Bearbeiten-Knopf.
  const restoreFocus = useRef(false)

  useEffect(() => {
    if (editing || !restoreFocus.current) return
    restoreFocus.current = false
    editButtonRef.current?.focus()
  }, [editing])

  const finish = () => {
    restoreFocus.current = true
    setEditing(false)
  }

  const apply = (next: ProjectProfile) => {
    onChange(next)
    finish()
  }

  return (
    <section
      aria-labelledby={titleId}
      className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {t('profile.title')}
      </h2>

      {editing ? (
        <ProfileForm profile={profile} onApply={apply} onCancel={finish} />
      ) : (
        <>
          <ProfileView profile={profile} />
          <div className="flex justify-end">
            <Button
              ref={editButtonRef}
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" aria-hidden />
              {t('profile.edit')}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

interface ProfileFormProps {
  profile: ProjectProfile
  onApply: (profile: ProjectProfile) => void
  onCancel: () => void
}

/** Formular zum Bearbeiten. Der Entwurf lebt nur, solange das Formular offen ist. */
function ProfileForm({ profile, onApply, onCancel }: ProfileFormProps) {
  const { t } = useTranslation()
  const baseId = useId()
  const ids = {
    pitch: `${baseId}-pitch`,
    problem: `${baseId}-problem`,
    audience: `${baseId}-audience`,
    platform: `${baseId}-platform`,
    features: `${baseId}-features`,
    featuresHint: `${baseId}-features-hint`,
    model: `${baseId}-model`,
    priceRange: `${baseId}-price-range`,
    reason: `${baseId}-reason`,
    effort: `${baseId}-effort`,
    risks: `${baseId}-risks`,
    risksHint: `${baseId}-risks-hint`,
  }
  const pitchRef = useRef<HTMLTextAreaElement>(null)

  const [pitch, setPitch] = useState(profile.pitch)
  const [problem, setProblem] = useState(profile.problem)
  const [audience, setAudience] = useState(profile.audience)
  const [platform, setPlatform] = useState(profile.platform)
  const [features, setFeatures] = useState(profile.features.join('\n'))
  const [model, setModel] = useState(profile.monetization.model)
  const [priceRange, setPriceRange] = useState(profile.monetization.priceRange)
  const [reason, setReason] = useState(profile.monetization.reason)
  const [effort, setEffort] = useState<ProfileEffort>(profile.effort)
  const [risks, setRisks] = useState(profile.risks.join('\n'))

  useEffect(() => {
    pitchRef.current?.focus()
  }, [])

  const canApply = pitch.trim() !== ''

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canApply) return
    onApply({
      pitch,
      problem,
      audience,
      platform,
      features: features.split('\n'),
      monetization: { model, priceRange, reason },
      effort,
      risks: risks.split('\n'),
    })
  }

  const textareaClass =
    'w-full resize-y rounded-md border border-border bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={ids.pitch} className="text-sm font-medium">
          {t('profile.fields.pitch')}
        </label>
        <textarea
          ref={pitchRef}
          id={ids.pitch}
          value={pitch}
          onChange={(event) => setPitch(event.target.value)}
          rows={3}
          className={textareaClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={ids.problem} className="text-sm font-medium">
          {t('profile.fields.problem')}
        </label>
        <textarea
          id={ids.problem}
          value={problem}
          onChange={(event) => setProblem(event.target.value)}
          rows={3}
          className={textareaClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={ids.audience} className="text-sm font-medium">
            {t('profile.fields.audience')}
          </label>
          <Input
            id={ids.audience}
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={ids.platform} className="text-sm font-medium">
            {t('profile.fields.platform')}
          </label>
          <Input
            id={ids.platform}
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={ids.features} className="text-sm font-medium">
          {t('profile.fields.features')}
        </label>
        <textarea
          id={ids.features}
          value={features}
          onChange={(event) => setFeatures(event.target.value)}
          aria-describedby={ids.featuresHint}
          rows={4}
          className={textareaClass}
        />
        <p id={ids.featuresHint} className="text-xs text-muted-foreground">
          {t('profile.fields.featuresHint')}
        </p>
      </div>

      <fieldset className="grid gap-4 rounded-md border border-border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">{t('profile.monetization')}</legend>
        <div className="space-y-1.5">
          <label htmlFor={ids.model} className="text-sm font-medium">
            {t('profile.fields.monetizationModel')}
          </label>
          <Input id={ids.model} value={model} onChange={(event) => setModel(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={ids.priceRange} className="text-sm font-medium">
            {t('profile.fields.priceRange')}
          </label>
          <Input
            id={ids.priceRange}
            value={priceRange}
            onChange={(event) => setPriceRange(event.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor={ids.reason} className="text-sm font-medium">
            {t('profile.fields.reason')}
          </label>
          <textarea
            id={ids.reason}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            className={textareaClass}
          />
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor={ids.effort} className="text-sm font-medium">
          {t('profile.fields.effort')}
        </label>
        <Select
          id={ids.effort}
          value={effort}
          onChange={(event) => setEffort(event.target.value as ProfileEffort)}
          className="sm:w-60"
        >
          {PROFILE_EFFORTS.map((option) => (
            <option key={option} value={option}>
              {t(`profile.effort.${option}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={ids.risks} className="text-sm font-medium">
          {t('profile.fields.risks')}
        </label>
        <textarea
          id={ids.risks}
          value={risks}
          onChange={(event) => setRisks(event.target.value)}
          aria-describedby={ids.risksHint}
          rows={3}
          className={textareaClass}
        />
        <p id={ids.risksHint} className="text-xs text-muted-foreground">
          {t('profile.fields.risksHint')}
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          <X className="size-4" aria-hidden />
          {t('profile.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={!canApply}>
          <Check className="size-4" aria-hidden />
          {t('profile.apply')}
        </Button>
      </div>
    </form>
  )
}
