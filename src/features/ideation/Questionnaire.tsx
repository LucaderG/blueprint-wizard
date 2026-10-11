import { LoaderCircle, Sparkles } from 'lucide-react'
import { useId, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AVAILABLE_TIMES, PLATFORM_PREFERENCES, profileStatus } from '@/core/ideation'
import { Button } from '@/shared/ui/button'
import { ChoiceChips } from './ChoiceChips'
import { TagField } from './TagField'
import type { IdeationController } from './useIdeation'

const INTEREST_KEYS = [
  'games',
  'music',
  'sport',
  'cooking',
  'travel',
  'money',
  'learning',
  'productivity',
  'health',
  'pets',
  'photography',
  'plants',
] as const
const SKILL_KEYS = ['none', 'html', 'javascript', 'python', 'design', 'spreadsheets'] as const

const TEXTAREA_CLASS =
  'w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50'

type QuestionnaireProps = Pick<
  IdeationController,
  | 'session'
  | 'hasAi'
  | 'canGenerate'
  | 'activity'
  | 'updateProfile'
  | 'generate'
  | 'startWithoutAi'
  | 'showIdeas'
>

/** Der kurze Fragebogen auf einer Seite: alles freiwillig, ein Klick erzeugt die Ideen. */
export function Questionnaire({
  session,
  hasAi,
  canGenerate,
  activity,
  updateProfile,
  generate,
  startWithoutAi,
  showIdeas,
}: QuestionnaireProps) {
  const { t } = useTranslation()
  const frustrationsId = useId()
  const learningGoalId = useId()
  const { profile } = session
  const status = profileStatus(profile)
  const busy = activity !== null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canGenerate) void generate()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{t('ideation.questionnaire.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('ideation.questionnaire.lead')}</p>
      </div>

      <TagField
        label={t('ideation.questionnaire.fields.interests.label')}
        hint={t('ideation.questionnaire.fields.interests.hint')}
        tags={profile.interests}
        suggestions={INTEREST_KEYS.map((key) =>
          t(`ideation.questionnaire.suggestions.interests.${key}`),
        )}
        disabled={busy}
        onChange={(interests) => updateProfile({ interests })}
      />

      <div className="space-y-2">
        <label htmlFor={frustrationsId} className="text-sm font-medium">
          {t('ideation.questionnaire.fields.frustrations.label')}
        </label>
        <textarea
          id={frustrationsId}
          rows={2}
          value={profile.frustrations}
          disabled={busy}
          placeholder={t('ideation.questionnaire.fields.frustrations.placeholder')}
          onChange={(event) => updateProfile({ frustrations: event.target.value })}
          className={TEXTAREA_CLASS}
        />
      </div>

      <TagField
        label={t('ideation.questionnaire.fields.skills.label')}
        hint={t('ideation.questionnaire.fields.skills.hint')}
        tags={profile.skills}
        suggestions={SKILL_KEYS.map((key) => t(`ideation.questionnaire.suggestions.skills.${key}`))}
        disabled={busy}
        onChange={(skills) => updateProfile({ skills })}
      />

      <div className="space-y-2">
        <label htmlFor={learningGoalId} className="text-sm font-medium">
          {t('ideation.questionnaire.fields.learningGoal.label')}
        </label>
        <textarea
          id={learningGoalId}
          rows={2}
          value={profile.learningGoal}
          disabled={busy}
          placeholder={t('ideation.questionnaire.fields.learningGoal.placeholder')}
          onChange={(event) => updateProfile({ learningGoal: event.target.value })}
          className={TEXTAREA_CLASS}
        />
      </div>

      <ChoiceChips
        label={t('ideation.questionnaire.fields.availableTime.label')}
        value={profile.availableTime}
        options={AVAILABLE_TIMES}
        optionLabel={(time) => t(`ideation.questionnaire.times.${time}`)}
        disabled={busy}
        allowClear
        onChange={(availableTime) => updateProfile({ availableTime })}
      />

      <ChoiceChips
        label={t('ideation.questionnaire.fields.platform.label')}
        value={profile.platform}
        options={PLATFORM_PREFERENCES}
        optionLabel={(platform) => t(`ideation.questionnaire.platforms.${platform}`)}
        disabled={busy}
        onChange={(platform) => updateProfile({ platform: platform ?? 'any' })}
      />

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {status.canGenerate
            ? t('ideation.questionnaire.progress', {
                answered: status.answered,
                total: status.total,
              })
            : t('ideation.questionnaire.needMore')}
        </p>
        <div className="flex flex-wrap gap-2">
          {session.ideas.length > 0 && (
            <Button type="button" variant="ghost" disabled={busy} onClick={showIdeas}>
              {t('ideation.questionnaire.backToIdeas')}
            </Button>
          )}
          {!hasAi && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void startWithoutAi()}
            >
              {t('ideation.questionnaire.withoutAi')}
            </Button>
          )}
          <Button type="submit" disabled={!canGenerate}>
            {activity === 'generate' ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {t('ideation.questionnaire.submit')}
          </Button>
        </div>
      </div>
      {!hasAi && (
        <p className="text-xs text-muted-foreground">{t('ideation.questionnaire.withoutAiHint')}</p>
      )}
    </form>
  )
}
