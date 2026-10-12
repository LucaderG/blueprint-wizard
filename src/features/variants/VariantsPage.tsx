import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useProjectRepository } from '@/app/useProjectRepository'
import { MAX_VARIANTS, MIN_VARIANTS } from '@/core/ai'
import type { Project } from '@/core/blueprint'
import { ApiKeyNotice } from '@/features/settings/ApiKeyNotice'
import { formatNumber } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Select } from '@/shared/ui/select'
import { useVariantGeneration } from './useVariantGeneration'
import { VariantCard } from './VariantCard'
import { readVariantsSession, type VariantsSession } from './variantsSession'

const VARIANT_COUNTS = Array.from(
  { length: MAX_VARIANTS - MIN_VARIANTS + 1 },
  (_, index) => MIN_VARIANTS + index,
)

type EntriesState = { status: 'loading' } | { status: 'ready'; entries: Project[] }

/**
 * Variantenseite: zeigt die Steckbriefe der letzten Erzeugung nebeneinander. „Neu erzeugen“ ersetzt
 * die Anzeige; die bisherigen Einträge bleiben im Papierkorb oder in der Bibliothek.
 */
export function VariantsPage() {
  const { t } = useTranslation()
  const repository = useProjectRepository()
  const generation = useVariantGeneration()
  const [session, setSession] = useState<VariantsSession | null>(readVariantsSession)
  const [state, setState] = useState<EntriesState>({ status: 'loading' })
  const [count, setCount] = useState(session?.count ?? MIN_VARIANTS)
  const [actionFailed, setActionFailed] = useState(false)
  const [now] = useState(() => new Date())
  const countId = useId()
  const ids = session?.ids

  useEffect(() => {
    if (!ids) return
    let active = true
    // Inzwischen endgültig gelöschte Einträge fehlen einfach.
    void Promise.all(ids.map((id) => repository.get(id).catch(() => null))).then((loaded) => {
      if (active) {
        setState({
          status: 'ready',
          entries: loaded.filter((entry): entry is Project => entry != null),
        })
      }
    })
    return () => {
      active = false
    }
  }, [ids, repository])

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{t('variants.title')}</h1>
        <p className="text-muted-foreground">{t('variants.none')}</p>
        <Button asChild>
          <Link to="/neu/teil-idee">{t('variants.enterIdea')}</Link>
        </Button>
      </div>
    )
  }

  const running = generation.state.status === 'running'
  const replaceEntry = (entry: Project) =>
    setState((current) =>
      current.status === 'ready'
        ? {
            status: 'ready',
            entries: current.entries.map((item) => (item.id === entry.id ? entry : item)),
          }
        : current,
    )

  function regenerate() {
    if (!session) return
    setActionFailed(false)
    generation.reset()
    void generation.generate(session.idea, count, ({ session: next, entries }) => {
      setSession(next)
      setState({ status: 'ready', entries })
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('variants.title')}</h1>
        <p className="text-muted-foreground">{t('variants.intro')}</p>
        <blockquote className="border-l-2 border-border pl-3 text-sm break-words whitespace-pre-line text-muted-foreground">
          {session.idea}
        </blockquote>
      </header>

      <ApiKeyNotice />

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={countId} className="text-sm font-medium">
          {t('variants.countLabel')}
        </label>
        <Select
          id={countId}
          value={count}
          disabled={running}
          onChange={(event) => setCount(Number(event.target.value))}
          className="w-auto disabled:opacity-50"
        >
          {VARIANT_COUNTS.map((value) => (
            <option key={value} value={value}>
              {formatNumber(value)}
            </option>
          ))}
        </Select>
        {running ? (
          <Button type="button" variant="outline" onClick={generation.cancel}>
            {t('wizard.form.cancel')}
          </Button>
        ) : (
          <Button type="button" disabled={!generation.available} onClick={regenerate}>
            {t('variants.regenerate')}
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link to="/neu/teil-idee">{t('variants.enterIdea')}</Link>
        </Button>
      </div>

      {running && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('variants.running')}
        </p>
      )}
      {generation.state.status === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {t(generation.state.errorKey)}
          {generation.state.detail && (
            <span className="mt-1 block text-xs break-words opacity-80">
              {generation.state.detail}
            </span>
          )}
        </p>
      )}
      {actionFailed && (
        <p role="alert" className="text-sm text-destructive">
          {t('projects.errors.generic')}
        </p>
      )}

      {state.status === 'loading' ? (
        <p className="text-muted-foreground">{t('variants.loading')}</p>
      ) : state.entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          {t('variants.gone')}
        </p>
      ) : (
        <ul
          aria-label={t('variants.listLabel')}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {state.entries.map((entry) => (
            <li key={entry.id}>
              <VariantCard
                entry={entry}
                now={now}
                onChange={replaceEntry}
                onError={() => setActionFailed(true)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
