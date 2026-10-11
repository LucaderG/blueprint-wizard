import { LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalysisFinding, BlueprintAnalysis } from '@/core/blueprint'
import { formatDateTime } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import type { AnalysisState } from './useInterview'

interface AnalysisPanelProps {
  analysis: BlueprintAnalysis | null
  state: AnalysisState
  hasAi: boolean
  /** Solange Antworten eingearbeitet werden, startet keine neue Analyse. */
  integrationRunning: boolean
  onAnalyze: () => void
  onCancel: () => void
}

/** Analyse des Blueprints: Lauf starten, Ladezustand, Fehler und das Ergebnis der letzten Analyse. */
export function AnalysisPanel({
  analysis,
  state,
  hasAi,
  integrationRunning,
  onAnalyze,
  onCancel,
}: AnalysisPanelProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const running = state.status === 'running'

  return (
    <section aria-labelledby={headingId} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-xl font-semibold">
          {t('interview.analysis.title')}
        </h2>
        {running ? (
          <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
              {t('interview.analysis.running')}
            </span>
            <Button variant="outline" size="sm" onClick={onCancel}>
              {t('interview.analysis.cancel')}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant={analysis ? 'outline' : 'default'}
            disabled={!hasAi || integrationRunning}
            onClick={onAnalyze}
          >
            <Sparkles className="size-4" aria-hidden />
            {analysis ? t('interview.analysis.rerun') : t('interview.analysis.run')}
          </Button>
        )}
      </div>

      {state.status === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {t(state.errorKey)}
          {state.detail && (
            <span className="mt-1 block text-xs break-words opacity-80">{state.detail}</span>
          )}
        </p>
      )}

      {analysis ? (
        <AnalysisResult analysis={analysis} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('interview.analysis.intro')}</p>
      )}
    </section>
  )
}

function AnalysisResult({ analysis }: { analysis: BlueprintAnalysis }) {
  const { t } = useTranslation()
  const contradictionsId = useId()
  const gapsId = useId()
  const hasFindings = analysis.contradictions.length > 0 || analysis.gaps.length > 0

  return (
    <div className="space-y-3">
      <p className="text-sm whitespace-pre-wrap">{analysis.summary}</p>
      <p className="text-xs text-muted-foreground">
        {t('interview.analysis.analyzedAt', { date: formatDateTime(analysis.analyzedAt) })}
      </p>

      {analysis.contradictions.length > 0 && (
        <section
          aria-labelledby={contradictionsId}
          className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3"
        >
          <h3
            id={contradictionsId}
            className="flex items-center gap-2 font-semibold text-destructive"
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {t('interview.analysis.contradictions')}
          </h3>
          <FindingList findings={analysis.contradictions} />
        </section>
      )}

      {analysis.gaps.length > 0 && (
        <details aria-labelledby={gapsId} className="space-y-2">
          <summary id={gapsId} className="cursor-pointer font-semibold">
            {t('interview.analysis.gapsWithCount', { count: analysis.gaps.length })}
          </summary>
          <div className="pt-2">
            <FindingList findings={analysis.gaps} />
          </div>
        </details>
      )}

      {!hasFindings && (
        <p className="text-sm text-muted-foreground">{t('interview.analysis.none')}</p>
      )}
    </div>
  )
}

function FindingList({ findings }: { findings: readonly AnalysisFinding[] }) {
  const { t } = useTranslation()
  return (
    <ul className="space-y-2 text-sm">
      {findings.map((finding, index) => (
        <li key={index} className="space-y-1">
          {finding.sectionIds.length > 0 && (
            <span className="mr-2 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {finding.sectionIds.map((id) => t(`sections.${id}`)).join(', ')}
            </span>
          )}
          <span>{finding.text}</span>
        </li>
      ))}
    </ul>
  )
}
