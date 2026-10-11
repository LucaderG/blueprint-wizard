import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '@/app/useSettings'
import { DEFAULT_MODEL, type ModelInfo } from '@/core/ai'
import { formatUsd } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { aiErrorKey } from './aiErrors'
import { SettingsSection } from './SettingsSection'
import { useModelCatalog } from './useModelCatalog'

const MIN_LIST_SIZE = 3
const MAX_LIST_SIZE = 8

/** Filtert nach Name oder Modell-ID, Groß- und Kleinschreibung egal. */
function matchesQuery(model: ModelInfo, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return model.name.toLowerCase().includes(needle) || model.id.toLowerCase().includes(needle)
}

/** Modellauswahl mit Suche. Die Liste lädt von OpenRouter; scheitert das, bleibt eine manuelle ID. */
export function ModelSection() {
  const { t } = useTranslation()
  const { settings, update } = useSettings()
  const { state, retry } = useModelCatalog()
  const filterId = useId()
  const selectId = useId()
  const manualId = useId()
  const [query, setQuery] = useState('')
  const [structuredOnly, setStructuredOnly] = useState(true)
  const [manualModel, setManualModel] = useState(settings.model)
  const [saved, setSaved] = useState(false)

  function selectModel(model: string) {
    update({ model })
    setManualModel(model)
    setSaved(true)
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const model = manualModel.trim()
    if (model) selectModel(model)
  }

  function price(value: number | null): string {
    if (value === null) return t('settings.model.unknownPrice')
    if (value === 0) return t('settings.model.free')
    return formatUsd(value)
  }

  const models = state.status === 'ready' ? state.models : []
  const filtered = models.filter(
    (model) => (!structuredOnly || model.supportsStructuredOutputs) && matchesQuery(model, query),
  )
  // Ein aktuelles Modell außerhalb der Filterergebnisse bleibt auswählbar, damit die Anzeige stimmt.
  const currentIsListed = filtered.some((model) => model.id === settings.model)

  return (
    <SettingsSection title={t('settings.model.title')} description={t('settings.model.intro')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {t('settings.model.current')}:{' '}
          <code className="font-mono break-all">{settings.model}</code>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => selectModel(DEFAULT_MODEL)}
        >
          {t('settings.model.restore')}
        </Button>
      </div>

      {state.status === 'loading' && (
        <p className="text-sm text-muted-foreground">{t('settings.model.loading')}</p>
      )}

      {state.status === 'error' && (
        <div className="space-y-4">
          <div
            role="alert"
            className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <p>{t('settings.model.loadError')}</p>
            <p>{t(aiErrorKey(state.error))}</p>
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              {t('settings.model.retry')}
            </Button>
          </div>
          <form onSubmit={handleManualSubmit} className="space-y-1.5">
            <label htmlFor={manualId} className="text-sm font-medium">
              {t('settings.model.manualLabel')}
            </label>
            <div className="flex gap-2">
              <Input
                id={manualId}
                value={manualModel}
                onChange={(event) => setManualModel(event.target.value)}
                placeholder={t('settings.model.manualPlaceholder')}
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="submit" variant="outline" disabled={!manualModel.trim()}>
                {t('settings.model.manualSubmit')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {state.status === 'ready' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <div className="space-y-1.5">
              <label htmlFor={filterId} className="text-sm font-medium">
                {t('settings.model.filterLabel')}
              </label>
              <Input
                id={filterId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('settings.model.filterPlaceholder')}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={structuredOnly}
                onChange={(event) => setStructuredOnly(event.target.checked)}
                className="size-4 accent-primary"
              />
              {t('settings.model.structuredOnly')}
            </label>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={selectId} className="text-sm font-medium">
              {t('settings.model.listLabel')}
            </label>
            <Select
              id={selectId}
              size={Math.min(MAX_LIST_SIZE, Math.max(MIN_LIST_SIZE, filtered.length))}
              value={settings.model}
              onChange={(event) => selectModel(event.target.value)}
            >
              {!currentIsListed && <option value={settings.model}>{settings.model}</option>}
              {filtered.map((model) => (
                <option key={model.id} value={model.id}>
                  {t('settings.model.optionLabel', {
                    name: model.name,
                    prices: t('settings.model.prices', {
                      input: price(model.promptPricePerMillion),
                      output: price(model.completionPricePerMillion),
                    }),
                  })}
                </option>
              ))}
            </Select>
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('settings.model.noResults')}</p>
            )}
          </div>
        </div>
      )}

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {saved && t('settings.saved')}
      </p>
    </SettingsSection>
  )
}
