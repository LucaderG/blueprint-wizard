import { Plus, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MAX_CHOSEN_MODELS,
  MONETIZATION_CRITERIA,
  MONETIZATION_MODEL_KINDS,
  type Monetization,
  type MonetizationModel,
  type MonetizationModelKind,
} from '@/core/blueprint'
import { combinationWarnings, isValidCombination } from '@/core/engine'
import type { AiTaskState } from '@/features/ai/useAiTask'
import { Button } from '@/shared/ui/button'
import { Select } from '@/shared/ui/select'
import { AiTaskControls, AiTaskError } from './AiTaskControls'

interface ModelsStepProps {
  monetization: Monetization | null
  state: AiTaskState
  hasAi: boolean
  onSuggest: () => void
  onCancel: () => void
  onAdd: (kind: MonetizationModelKind) => void
  onChoose: (modelIds: string[], rationale: string) => void
}

/** Schritt 1: Modelle vorstellen, vergleichen und ein Modell oder eine Kombination wählen. */
export function ModelsStep({
  monetization,
  state,
  hasAi,
  onSuggest,
  onCancel,
  onAdd,
  onChoose,
}: ModelsStepProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const models = monetization?.models ?? []

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={headingId} className="text-xl font-semibold">
            {t('monetization.models.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('monetization.models.intro')}</p>
        </div>
        <AiTaskControls
          state={state}
          hasAi={hasAi}
          label={models.length ? t('monetization.models.rerun') : t('monetization.models.suggest')}
          runningLabel={t('monetization.models.running')}
          onRun={onSuggest}
          onCancel={onCancel}
        />
      </div>

      <AiTaskError state={state} />

      {models.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('monetization.models.empty')}</p>
      ) : (
        <>
          <ComparisonTable models={models} />
          {/* Neu aufbauen, sobald sich die gespeicherte Auswahl ändert (z. B. nach Rückgängig). */}
          <ModelSelection
            key={`${monetization?.chosenModelIds.join()}|${monetization?.modelRationale}`}
            models={models}
            chosenIds={monetization?.chosenModelIds ?? []}
            rationale={monetization?.modelRationale ?? ''}
            onChoose={onChoose}
          />
        </>
      )}

      <AddModel models={models} onAdd={onAdd} />
    </section>
  )
}

/** Anzeigename eines Modells: eigener Titel der KI oder der feste Name. */
function useModelName() {
  const { t } = useTranslation()
  return (model: Pick<MonetizationModel, 'kind' | 'title'>) =>
    model.title || t(`monetization.kinds.${model.kind}`)
}

/** Vergleich der bewerteten Modelle nach einheitlichen Kriterien (Zeilen = Kriterien). */
function ComparisonTable({ models }: { models: MonetizationModel[] }) {
  const { t } = useTranslation()
  const name = useModelName()
  const scored = models.filter((m) => m.scores !== null)
  if (scored.length === 0) return null

  return (
    // Auf schmalen Bildschirmen scrollt die Tabelle seitlich; per Tastatur fokussierbar (axe).
    <div
      tabIndex={0}
      role="region"
      aria-label={t('monetization.models.compareCaption')}
      className="overflow-x-auto rounded-lg border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <table className="w-full min-w-max text-sm">
        <caption className="px-4 pt-3 text-left text-sm text-muted-foreground">
          {t('monetization.models.compareCaption')}
        </caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="px-4 py-2 text-left font-medium">
              {t('monetization.models.criterion')}
            </th>
            {scored.map((model) => (
              <th key={model.id} scope="col" className="px-4 py-2 text-left font-medium">
                {name(model)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MONETIZATION_CRITERIA.map((criterion) => (
            <tr key={criterion} className="border-b last:border-b-0">
              <th scope="row" className="px-4 py-2 text-left font-normal text-muted-foreground">
                {t(`monetization.criteria.${criterion}`)}
              </th>
              {scored.map((model) => {
                const score = model.scores?.[criterion] ?? 0
                return (
                  <td key={model.id} className="px-4 py-2">
                    <span
                      role="img"
                      aria-label={t('monetization.models.score', { score })}
                      className="font-mono tracking-widest"
                    >
                      <span className="text-primary">{'●'.repeat(score)}</span>
                      <span className="text-muted-foreground/40">{'●'.repeat(5 - score)}</span>
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ModelSelectionProps {
  models: MonetizationModel[]
  chosenIds: string[]
  rationale: string
  onChoose: (modelIds: string[], rationale: string) => void
}

/** Modellkarten zum Ankreuzen, Hinweise zur Kombination, Begründung und Übernehmen. */
function ModelSelection({ models, chosenIds, rationale, onChoose }: ModelSelectionProps) {
  const { t } = useTranslation()
  const name = useModelName()
  const rationaleId = useId()
  const [selected, setSelected] = useState<string[]>(chosenIds)
  const [draft, setDraft] = useState(rationale)

  const kinds = selected.flatMap((id) => models.find((m) => m.id === id)?.kind ?? [])
  const valid = isValidCombination(kinds)
  const warnings = combinationWarnings(kinds)
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
          {t('monetization.models.selectLegend', { max: MAX_CHOSEN_MODELS })}
        </legend>
        {models.map((model) => {
          const checked = selected.includes(model.id)
          return (
            <div
              key={model.id}
              className="space-y-2 rounded-lg border bg-card p-4 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <label className="flex cursor-pointer flex-wrap items-start gap-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && selected.length >= MAX_CHOSEN_MODELS}
                  onChange={() => toggle(model.id)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="font-semibold break-words">{name(model)}</span>
                {model.title && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {t(`monetization.kinds.${model.kind}`)}
                  </span>
                )}
                {model.recommended && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t('monetization.recommended')}
                  </span>
                )}
              </label>
              <div className="space-y-2 pl-7 break-words">
                {model.summary && <p>{model.summary}</p>}
                {model.fitReason && (
                  <p className="text-muted-foreground">
                    {t('monetization.models.fit', { text: model.fitReason })}
                  </p>
                )}
                {model.concerns.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('monetization.models.concerns')}
                    </p>
                    <ul className="list-disc pl-5">
                      {model.concerns.map((concern, index) => (
                        <li key={index}>{concern}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {model.scores === null && (
                  <p className="text-xs text-muted-foreground">
                    {t('monetization.models.unscored')}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </fieldset>

      {(!valid || warnings.length > 0) && (
        <ul className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          {!valid && <Warning text={t('monetization.warnings.noneCombined')} />}
          {warnings.map((warning) => (
            <Warning key={warning.code} text={t(`monetization.warnings.${warning.code}`)} />
          ))}
        </ul>
      )}

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
          <p className="text-sm text-muted-foreground">{t('monetization.models.saved')}</p>
        )}
        <Button
          type="button"
          size="sm"
          disabled={selected.length === 0 || !valid || unchanged}
          onClick={() => onChoose(selected, draft)}
        >
          {t('monetization.models.apply')}
        </Button>
      </div>
    </div>
  )
}

function Warning({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <span>{text}</span>
    </li>
  )
}

/** Ein Modell aus der festen Liste von Hand ergänzen (auch ohne KI). */
function AddModel({
  models,
  onAdd,
}: {
  models: MonetizationModel[]
  onAdd: (kind: MonetizationModelKind) => void
}) {
  const { t } = useTranslation()
  const selectId = useId()
  const missing = MONETIZATION_MODEL_KINDS.filter((kind) => !models.some((m) => m.kind === kind))
  const [kind, setKind] = useState<MonetizationModelKind | ''>('')
  if (missing.length === 0) return null
  const value = kind && missing.includes(kind) ? kind : ''

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1 space-y-1.5">
        <label htmlFor={selectId} className="text-sm font-medium">
          {t('monetization.models.addLabel')}
        </label>
        <Select
          id={selectId}
          value={value}
          onChange={(event) => setKind(event.target.value as MonetizationModelKind | '')}
        >
          <option value="">{t('monetization.choose')}</option>
          {missing.map((option) => (
            <option key={option} value={option}>
              {t(`monetization.kinds.${option}`)}
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
          setKind('')
        }}
      >
        <Plus className="size-4" aria-hidden />
        {t('monetization.models.add')}
      </Button>
    </div>
  )
}
