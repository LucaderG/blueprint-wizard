import { ArrowLeft, Redo2, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  acceptSuggestion,
  computeCompleteness,
  SECTION_IDS,
  updateSection,
  type Maturity,
  type SectionId,
} from '@/core/blueprint'
import type { ProjectEditorState } from '@/features/projects/useProjectEditor'
import { CompletenessBar } from '@/features/projects/CompletenessBar'
import { Button } from '@/shared/ui/button'
import { MaturitySummary } from './MaturitySummary'
import { SaveStatus } from './SaveStatus'
import { SectionCard } from './SectionCard'
import { countByMaturity } from './maturity'
import { useHistoryShortcuts } from './useHistoryShortcuts'

type ReadyState = Extract<ProjectEditorState, { status: 'ready' }>

export type BlueprintOverviewProps = Omit<ReadyState, 'status'>

/** Bearbeitbare Übersicht eines Projekts: Kopfzeile, Reifegrade und alle Abschnitte. */
export function BlueprintOverview({
  project,
  saveState,
  canUndo,
  canRedo,
  edit,
  undo,
  redo,
  flush,
}: BlueprintOverviewProps) {
  const { t } = useTranslation()
  const completeness = computeCompleteness(project.blueprint)
  const counts = countByMaturity(project.blueprint)

  useHistoryShortcuts({ canUndo, canRedo, undo, redo })

  const setContent = (id: SectionId, content: string) =>
    edit((current) => updateSection(current, id, { content }))
  const setMaturity = (id: SectionId, maturity: Maturity) =>
    edit((current) => updateSection(current, id, { maturity }))
  const accept = (id: SectionId) => edit((current) => acceptSuggestion(current, id))

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('projects.page.back')}
      </Link>

      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight break-words">{project.name}</h1>
        <CompletenessBar value={completeness.total} label={t('projects.page.completenessLabel')} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={!canUndo} onClick={undo}>
              <Undo2 className="size-4" aria-hidden />
              {t('blueprint.toolbar.undo')}
            </Button>
            <Button variant="outline" size="sm" disabled={!canRedo} onClick={redo}>
              <Redo2 className="size-4" aria-hidden />
              {t('blueprint.toolbar.redo')}
            </Button>
          </div>
          <SaveStatus saveState={saveState} onRetry={() => void flush()} />
        </div>
      </header>

      <MaturitySummary counts={counts} />

      <section aria-labelledby="sections-heading" className="space-y-3">
        <h2 id="sections-heading" className="text-xl font-semibold">
          {t('projects.page.sectionsTitle')}
        </h2>
        <ol aria-labelledby="sections-heading" className="space-y-3">
          {SECTION_IDS.map((id) => (
            <li key={id}>
              <SectionCard
                section={project.blueprint.sections[id]}
                onContentChange={(content) => setContent(id, content)}
                onMaturityChange={(maturity) => setMaturity(id, maturity)}
                onAcceptSuggestion={() => accept(id)}
              />
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
