import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MAX_CHOSEN_PRICING,
  PRICING_STRATEGY_KINDS,
  type Monetization,
  type PricingOption,
  type PricingStrategyKind,
} from '@/core/blueprint'
import type { AiTaskState } from '@/features/ai/useAiTask'
import { Button } from '@/shared/ui/button'
import { Select } from '@/shared/ui/select'
import { AiTaskControls, AiTaskError } from './AiTaskControls'

interface PricingStepProps {
  monetization: Monetization
  state: AiTaskState
  hasAi: boolean
  onSuggest: () => void
  onCancel: () => void
  onAdd: (strategy: PricingStrategyKind) => void
  onChoose: (optionIds: string[], rationale: string) => void
}

/** Schritt 2: Preisstrategien zu den gewählten Modellen vorschlagen und wählen. */
export function PricingStep({
  monetization,
  state,
  hasAi,
  onSuggest,
  onCancel,
  onAdd,
  onChoose,
}: PricingStepProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const options = monetization.pricingOptions

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={headingId} className="text-xl font-semibold">
            {t('monetization.pricing.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('monetization.pricing.intro')}</p>
        </div>
        <AiTaskControls
          state={state}
          hasAi={hasAi}
          label={
            options.length ? t('monetization.pricing.rerun') : t('monetization.pricing.suggest')
          }
          runningLabel={t('monetization.pricing.running')}
          onRun={onSuggest}
          onCancel={onCancel}
        />
      </div>

      <AiTaskError state={state} />

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('monetization.pricing.empty')}</p>
      ) : (
        <PricingSelection
          key={`${monetization.chosenPricingIds.join()}|${monetization.pricingRationale}`}
          options={options}
          chosenIds={monetization.chosenPricingIds}
          rationale={monetization.pricingRationale}
          onChoose={onChoose}
        />
      )}

      <AddPricing options={options} onAdd={onAdd} />
    </section>
  )
}

interface PricingSelectionProps {
  options: PricingOption[]
  chosenIds: string[]
  rationale: string
  onChoose: (optionIds: string[], rationale: string) => void
}

function PricingSelection({ options, chosenIds, rationale, onChoose }: PricingSelectionProps) {
  const { t } = useTranslation()
  const rationaleId = useId()
  const [selected, setSelected] = useState<string[]>(chosenIds)
  const [draft, setDraft] = useState(rationale)
  const unchanged =
    selected.length === chosenIds.length &&
    selected.every((id) => chosenIds.includes(id)) &&
    draft.trim() === rationale
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    )

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">
          {t('monetization.pricing.selectLegend', { max: MAX_CHOSEN_PRICING })}
        </legend>
        {options.map((option) => {
          const checked = selected.includes(option.id)
          return (
            <div
              key={option.id}
              className="space-y-2 rounded-lg border bg-card p-4 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <label className="flex cursor-pointer flex-wrap items-start gap-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && selected.length >= MAX_CHOSEN_PRICING}
                  onChange={() => toggle(option.id)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="font-semibold break-words">
                  {option.title || t(`monetization.strategies.${option.strategy}`)}
                </span>
                {option.title && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {t(`monetization.strategies.${option.strategy}`)}
                  </span>
                )}
                {option.recommended && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t('monetization.recommended')}
                  </span>
                )}
              </label>
              <div className="space-y-2 pl-7 break-words">
                {option.summary && <p>{option.summary}</p>}
                {option.examplePrices && (
                  <p>
                    <span className="font-medium">{t('monetization.pricing.examplePrices')}</span>{' '}
                    {option.examplePrices}
                  </p>
                )}
                {option.reason && <p className="text-muted-foreground">{option.reason}</p>}
              </div>
            </div>
          )
        })}
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor={rationaleId} className="text-sm font-medium">
          {t('monetization.rationaleLabel')}
        </label>
        <textarea
          id={rationaleId}
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-full rounded-md border border-border bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {chosenIds.length > 0 && unchanged && (
          <p className="text-sm text-muted-foreground">{t('monetization.pricing.saved')}</p>
        )}
        <Button
          type="button"
          size="sm"
          disabled={selected.length === 0 || unchanged}
          onClick={() => onChoose(selected, draft)}
        >
          {t('monetization.pricing.apply')}
        </Button>
      </div>
    </div>
  )
}

/** Eine Preisstrategie aus der festen Liste von Hand ergänzen (auch ohne KI). */
function AddPricing({
  options,
  onAdd,
}: {
  options: PricingOption[]
  onAdd: (strategy: PricingStrategyKind) => void
}) {
  const { t } = useTranslation()
  const selectId = useId()
  const missing = PRICING_STRATEGY_KINDS.filter((s) => !options.some((o) => o.strategy === s))
  const [strategy, setStrategy] = useState<PricingStrategyKind | ''>('')
  if (missing.length === 0) return null
  const value = strategy && missing.includes(strategy) ? strategy : ''

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1 space-y-1.5">
        <label htmlFor={selectId} className="text-sm font-medium">
          {t('monetization.pricing.addLabel')}
        </label>
        <Select
          id={selectId}
          value={value}
          onChange={(event) => setStrategy(event.target.value as PricingStrategyKind | '')}
        >
          <option value="">{t('monetization.choose')}</option>
          {missing.map((option) => (
            <option key={option} value={option}>
              {t(`monetization.strategies.${option}`)}
            </option>
          ))}
        </Select>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!value}
        onClick={() => {
          if (value) onAdd(value)
          setStrategy('')
        }}
      >
        <Plus className="size-4" aria-hidden />
        {t('monetization.pricing.add')}
      </Button>
    </div>
  )
}
