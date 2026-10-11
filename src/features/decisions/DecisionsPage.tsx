import { ArrowLeft, Redo2, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { SaveStatus } from '@/features/blueprint/SaveStatus'
import { useHistoryShortcuts } from '@/features/blueprint/useHistoryShortcuts'
import { useProjectEditor, type ProjectEditorState } from '@/features/projects/useProjectEditor'
import { ApiKeyNotice } from '@/features/settings/ApiKeyNotice'
import { Button } from '@/shared/ui/button'
import { AdditionsPanel } from './AdditionsPanel'
import { ContradictionWarnings } from './ContradictionWarnings'
import { DecisionList } from './DecisionList'
import { DecisionLog } from './DecisionLog'
import { useDecisions } from './useDecisions'

type ReadyState = Extract<ProjectEditorState, { status: 'ready' }>

/** Seite „Entscheidungen & Vorschläge“ eines Projekts: Widersprüche, Kernentscheidungen, Vorschläge, Protokoll. */
export function DecisionsPage() {
  const { t } = useTranslation()
  const { projectId = '' } = useParams()
  const state = useProjectEditor(projectId)

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-muted-foreground">
        {t('projects.page.loading')}
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-destructive">
        {t('projects.page.loadError')}
      </p>
    )
  }

  if (state.status === 'notFound') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">{t('projects.page.notFoundTitle')}</h1>
        <p className="text-muted-foreground">{t('projects.page.notFoundText')}</p>
        <Button asChild>
          <Link to="/">{t('projects.page.home')}</Link>
        </Button>
      </div>
    )
  }

  return <DecisionsView {...state} />
}

/** Der eigentliche Entscheidungs-Bildschirm für ein geladenes Projekt. */
function DecisionsView(editor: ReadyState) {
  const { t } = useTranslation()
  const { project, saveState, canUndo, canRedo, undo, redo, flush } = editor
  const controller = useDecisions(editor)

  useHistoryShortcuts({ canUndo, canRedo, undo, redo })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={`/projekte/${project.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('decisions.page.back')}
      </Link>

      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight break-words">{project.name}</h1>
        <p className="text-muted-foreground">{t('decisions.page.lead')}</p>
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

      <ApiKeyNotice />

      <ContradictionWarnings
        rules={controller.contradictions}
        aiFindings={controller.aiContradictions}
      />

      <DecisionList
        ranking={controller.ranking}
        state={controller.identifyState}
        hasAi={controller.hasAi}
        onIdentify={() => void controller.identify()}
        onCancel={controller.cancelIdentify}
        onDecide={controller.decide}
        onDismiss={controller.dismiss}
      />

      <AdditionsPanel
        openAdditions={controller.openAdditions}
        acceptedCount={controller.acceptedCount}
        rejectedCount={controller.rejectedCount}
        state={controller.suggestState}
        hasAi={controller.hasAi}
        onSuggest={() => void controller.suggest()}
        onCancel={controller.cancelSuggest}
        onAccept={controller.accept}
        onReject={controller.reject}
      />

      <DecisionLog decisions={controller.ranking.log} onReopen={controller.reopen} />
    </div>
  )
}
